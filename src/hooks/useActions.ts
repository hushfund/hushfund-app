import { useCallback } from 'react'
import { createElement } from 'react'
import {
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  parseAbiParameters,
  recoverTypedDataAddress,
  type Hex,
  type PublicClient,
} from 'viem'
import { useSignTypedData } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { vaultAbi } from '../contracts/vaultAbi.ts'
import { RECEIVE_WITH_AUTHORIZATION_TYPES, usdcAbi } from '../contracts/usdc.ts'
import { api, type AppConfig, type VaultInfo } from '../lib/api.ts'
import { CHAIN, NOTE_NETWORK } from '../lib/env.ts'
import { generateCommitment } from '../zk/commitment.ts'
import { decodeNote, encodeNote, parseNotePrefix, type Note } from '../zk/note.ts'
import { generateProof, noteHashes } from '../zk/proof.ts'
import { bytesToHex, hexToBytes } from '../zk/utils.ts'
import { useWallet } from './useWallet.ts'
import { useNotes } from './useNotes.tsx'
import { NoteModal, useUi } from '../components/ui.tsx'
import { DoneCard } from '../components/DoneCard.tsx'
import { lifiQuote, lifiWaitForBridge } from './useLiFi.ts'
import { recordRecoveryTransaction } from '../lib/recovery.ts'
import { waitForConfirmedTransaction } from '../lib/transactions.ts'

const ZERO = '0x0000000000000000000000000000000000000000' as const

export interface ParsedNote {
  note: Note
  raw: string
  denomination: number
  vault: VaultInfo
}

/** Reads a pasted note and finds its vault by the amount in the prefix. */
export function parseNote(raw: string, config: AppConfig | undefined): ParsedNote {
  const prefix = parseNotePrefix(raw)
  if (!prefix) throw new Error('Paste a full Hushfund note (it starts with "hushfund-").')
  if (prefix.currency !== 'usdc') throw new Error('Only USDC notes are supported.')
  if (prefix.network !== NOTE_NETWORK) throw new Error(`This note is for ${prefix.network}, but the app is on ${NOTE_NETWORK}.`)
  const vault = config?.vaults.find((v) => v.denominationUsdc === prefix.amount)
  if (!vault) throw new Error(`There is no ${prefix.amount} USDC vault on this network.`)
  return { note: decodeNote(raw), raw: raw.trim(), denomination: prefix.amount, vault }
}

const domainCache = new Map<string, { name: string; version: string }>()
async function usdcDomain(client: PublicClient, usdc: `0x${string}`) {
  const hit = domainCache.get(usdc)
  if (hit) return hit
  // Read the token's EIP-712 name instead of hard-coding it.
  const [name, version] = await Promise.all([
    client.readContract({ address: usdc, abi: usdcAbi, functionName: 'name' }),
    client.readContract({ address: usdc, abi: usdcAbi, functionName: 'version' }),
  ])
  const d = { name, version }
  domainCache.set(usdc, d)
  return d
}

export function useActions(config: AppConfig | undefined) {
  const { send, assertReady, publicClient, address } = useWallet()
  const queryClient = useQueryClient()
  const { signTypedDataAsync } = useSignTypedData()
  const { startFlow, toast, requireBackup } = useUi()
  const notes = useNotes()

  const read = useCallback(
    <T,>(vault: `0x${string}`, functionName: string, args: readonly unknown[] = []) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicClient.readContract({ address: vault, abi: vaultAbi, functionName: functionName as any, args: args as any }) as Promise<T>,
    [publicClient],
  )

  /** Signs USDC receiveWithAuthorization with a nonce chosen by the vault, and abi-encodes it. */
  const signReceive = useCallback(
    async (to: `0x${string}`, value: bigint, nonce: Hex) => {
      if (!address || !config) throw new Error('Sign in first')
      await assertReady()
      const domain = await usdcDomain(publicClient, config.usdc)
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600)
      const typedData = {
        domain: { ...domain, chainId: CHAIN.id, verifyingContract: config.usdc },
        types: RECEIVE_WITH_AUTHORIZATION_TYPES,
        primaryType: 'ReceiveWithAuthorization' as const,
        message: { from: getAddress(address), to: getAddress(to), value, validAfter: 0n, validBefore, nonce },
      }
      const sig = await signTypedDataAsync({ ...typedData, account: address })
      if (!/^0x[0-9a-fA-F]{130}$/.test(sig) ||
          (await recoverTypedDataAddress({ ...typedData, signature: sig })).toLowerCase() !== address.toLowerCase()) {
        throw new Error('The wallet signature does not match the signed-in account. Reconnect your wallet and try again.')
      }
      const r = `0x${sig.slice(2, 66)}` as Hex
      const s = `0x${sig.slice(66, 130)}` as Hex
      const vRaw = parseInt(sig.slice(130, 132), 16)
      const v = vRaw < 27 ? vRaw + 27 : vRaw
      return encodeAbiParameters(parseAbiParameters('address, address, uint256, uint256, uint256, bytes32, uint8, bytes32, bytes32'), [
        getAddress(address),
        getAddress(to),
        value,
        0n,
        validBefore,
        nonce,
        v,
        r,
        s,
      ])
    },
    [address, config, publicClient, signTypedDataAsync, assertReady],
  )

  const waitOk = useCallback(
    async (hash: Hex) => {
      const receipt = await waitForConfirmedTransaction(publicClient, hash)
      // A confirmed write must refresh wallet balances, vault totals, and any displayed note state.
      void queryClient.invalidateQueries({
        predicate: (query) => ['stats', 'note', 'readContract', 'balance'].includes(String(query.queryKey[0])),
      }).catch(() => { /* Polling remains the freshness path if a refetch fails. */ })
      return receipt
    },
    [publicClient, queryClient],
  )

  // ---------------------------------------------------------------- deposit

  const deposit = useCallback(
    async (vault: VaultInfo) => {
      const flow = startFlow(`Depositing ${vault.denominationUsdc} USDC`, [
        'Creating your secret note',
        'Signing the USDC authorization',
        config?.sponsoredGas ? 'Submitting (gas paid by Hushfund)' : 'Submitting from your wallet (you pay gas in ETH)',
        'Confirming on Ethereum',
      ])
      try {
        const c = await generateCommitment()
        const recoveryNote = encodeNote(c.commitment, c.nullifier, c.secret, new Uint8Array(32), 'usdc', vault.denominationUsdc, NOTE_NETWORK)
        await requireBackup({
          version: 1, chainId: 1, action: 'deposit', vault: vault.address, denomination: vault.denominationUsdc,
          draftNote: recoveryNote,
          createdAt: Math.floor(Date.now() / 1000),
        })
        flow.step(1)
        const nonce = await read<Hex>(vault.address, 'depositNonce', [c.commitmentHex])
        const auth = await signReceive(vault.address, BigInt(vault.denominationUsdc) * 1_000_000n, nonce)
        flow.step(2)
        // gas-free: the Hushfund relayer submits the signed deposit; otherwise the user's wallet sends it
        const hash = config?.sponsoredGas
          ? (await api.relayDeposit({ vault: vault.address, innerCommitment: c.commitmentHex, auth })).txHash
          : await send([
              { to: vault.address, data: encodeFunctionData({ abi: vaultAbi, functionName: 'depositWithAuthorization', args: [c.commitmentHex as Hex, auth] }) },
            ])
        if (!await recordRecoveryTransaction(recoveryNote, hash)) toast('Transaction status could not be saved in this browser. Keep your recovery file; it still works after confirmation.')
        flow.step(3)
        const receipt = await waitOk(hash)
        if (receipt.transactionHash !== hash) await recordRecoveryTransaction(recoveryNote, receipt.transactionHash)
        let yieldIndex: bigint | null = null
        let commitment: Hex | null = null
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== vault.address.toLowerCase()) continue
          try {
            const ev = decodeEventLog({ abi: vaultAbi, data: log.data, topics: log.topics as [Hex, ...Hex[]] })
            if (ev.eventName === 'Commitment') {
              yieldIndex = ev.args.yieldIndex
              commitment = ev.args.commitment
            }
          } catch {
            /* other event */
          }
        }
        if (yieldIndex === null || !commitment) throw new Error('Deposit confirmed but the receipt had no Commitment event. Check the transaction on Etherscan.')

        const yiBytes = hexToBytes('0x' + yieldIndex.toString(16).padStart(64, '0'))
        const raw = encodeNote(c.commitment, c.nullifier, c.secret, yiBytes, 'usdc', vault.denominationUsdc, NOTE_NETWORK)
        const h = await noteHashes(decodeNote(raw))
        notes.add({
          note: raw,
          vault: vault.address,
          denomination: vault.denominationUsdc,
          createdAt: Math.floor(Date.now() / 1000),
          commitment: h.commitment,
          nullifierHash: h.nullifierHash,
          collateralNullifierHash: h.collateralNullifierHash,
          yieldIndex: yieldIndex.toString(),
          status: 'active',
        })
        flow.done(
          createElement(NoteModal, {
            title: 'Deposit successful',
            note: raw,
            intro: 'This note is the only way to withdraw or borrow against your deposit. Nobody, including Hushfund, can recover it for you.',
          }),
        )
      } catch (e) {
        flow.fail(e)
      }
    },
    [startFlow, read, signReceive, send, waitOk, notes, config, requireBackup, toast],
  )

  // ---------------------------------------------------------------- relayer helpers

  const relayParams = useCallback(
    async (action: 'withdraw' | 'borrow', useRelayer: boolean) => {
      if (!useRelayer) return { relayer: ZERO as `0x${string}`, fee: 0n }
      const q = await api.quote(action)
      return { relayer: q.relayer, fee: BigInt(q.fee) }
    },
    [],
  )

  // ---------------------------------------------------------------- withdraw

  const withdraw = useCallback(
    async (p: { parsed: ParsedNote; recipient: `0x${string}`; useRelayer: boolean }) => {
      const { parsed } = p
      const flow = startFlow(`Withdrawing ${parsed.denomination} USDC`, [
        'Loading the deposit tree',
        'Getting a relayer quote',
        'Generating the zero-knowledge proof',
        p.useRelayer ? 'Relayer submitting the withdrawal' : 'Submitting from your wallet',
        'Confirming on Ethereum',
      ])
      try {
        const { commitments } = await api.commitments(parsed.vault.address)
        flow.step(1)
        const { relayer, fee } = await relayParams('withdraw', p.useRelayer)
        const ext = await read<Hex>(parsed.vault.address, 'withdrawExtDataHash', [p.recipient, relayer, fee])
        flow.step(2)
        const proof = await generateProof('withdraw', parsed.note, commitments, ext)
        flow.step(3)
        const hash = p.useRelayer
          ? (
              await api.relayWithdraw({
                vault: parsed.vault.address,
                proof: proof.proof,
                root: proof.root,
                nullifierHash: proof.nullifierHash,
                collateralNullifierHash: proof.collateralNullifierHash,
                yieldIndex: proof.yieldIndex.toString(),
                recipient: p.recipient,
                relayerFee: fee.toString(),
              })
            ).txHash
          : await send([
              {
                to: parsed.vault.address,
                data: encodeFunctionData({
                  abi: vaultAbi,
                  functionName: 'withdraw',
                  args: [proof.proof, proof.root, proof.nullifierHash, proof.collateralNullifierHash, proof.yieldIndex, p.recipient, ZERO, 0n],
                }),
              },
            ])
        flow.step(4)
        const receipt = await waitOk(hash)
        let received = 0n
        for (const log of receipt.logs) {
          try {
            const ev = decodeEventLog({ abi: vaultAbi, data: log.data, topics: log.topics as [Hex, ...Hex[]] })
            if (ev.eventName === 'Withdrawal') received = ev.args.payout
          } catch {
            /* other event */
          }
        }
        const stored = notes.notes.find((n) => n.note === parsed.raw)
        if (stored) notes.update(stored.commitment, { status: 'withdrawn' })
        flow.done(createElement(DoneCard, { title: 'Withdrawal successful', amount: received, to: p.recipient, txHash: receipt.transactionHash }))
      } catch (e) {
        flow.fail(e)
      }
    },
    [startFlow, relayParams, read, send, waitOk, notes],
  )

  // ---------------------------------------------------------------- bridge (from the signed-in wallet)

  /** Bridges USDC held by the signed-in wallet to another chain with LI.FI. The wallet pays gas in ETH. */
  const bridge = useCallback(
    async (p: { amount: bigint; toChainId: number; toToken: string; toAddress: `0x${string}`; label: string }) => {
      const flow = startFlow(`Bridging to ${p.label}`, ['Getting a LI.FI route', 'Approving USDC', 'Sending the bridge transaction', 'Waiting for delivery'])
      try {
        if (!address || !config) throw new Error('Sign in first')
        const quote = await lifiQuote({ fromAmount: p.amount.toString(), fromAddress: address, toAddress: p.toAddress, toChainId: p.toChainId, toToken: p.toToken, fromToken: config.usdc })
        flow.step(1)
        const spender = (quote.estimate.approvalAddress ?? quote.transactionRequest.to) as Hex
        await waitOk(await send([{ to: config.usdc, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, p.amount] }) }]))
        flow.step(2)
        const hash = await send([{ to: quote.transactionRequest.to as Hex, data: quote.transactionRequest.data as Hex, value: BigInt(quote.transactionRequest.value || '0') }])
        flow.step(3)
        const receipt = await waitOk(hash)
        await lifiWaitForBridge(receipt.transactionHash)
        flow.done(createElement(DoneCard, { title: `Delivered on ${p.label}`, to: p.toAddress, txHash: receipt.transactionHash }))
      } catch (e) {
        flow.fail(e)
      }
    },
    [startFlow, address, config, send, waitOk],
  )

  // ---------------------------------------------------------------- borrow

  const borrow = useCallback(
    async (p: { parsed: ParsedNote; recipient: `0x${string}`; amount: bigint; useRelayer: boolean }) => {
      const { parsed } = p
      const flow = startFlow(`Borrowing ${(Number(p.amount) / 1e6).toFixed(2)} USDC`, [
        'Loading the deposit tree',
        'Getting a relayer quote',
        'Generating the zero-knowledge proof',
        p.useRelayer ? 'Relayer submitting the loan' : 'Submitting from your wallet',
        'Confirming on Ethereum',
      ])
      try {
        const { commitments } = await api.commitments(parsed.vault.address)
        flow.step(1)
        const { relayer, fee } = await relayParams('borrow', p.useRelayer)
        const ext = await read<Hex>(parsed.vault.address, 'borrowExtDataHash', [p.recipient, relayer, fee, p.amount])
        flow.step(2)
        const proof = await generateProof('borrow', parsed.note, commitments, ext)
        flow.step(3)
        const hash = p.useRelayer
          ? (
              await api.relayBorrow({
                vault: parsed.vault.address,
                proof: proof.proof,
                root: proof.root,
                collateralNullifierHash: proof.collateralNullifierHash,
                yieldIndex: proof.yieldIndex.toString(),
                recipient: p.recipient,
                amount: p.amount.toString(),
                relayerFee: fee.toString(),
              })
            ).txHash
          : await send([
              {
                to: parsed.vault.address,
                data: encodeFunctionData({
                  abi: vaultAbi,
                  functionName: 'borrow',
                  args: [proof.proof, proof.root, proof.collateralNullifierHash, proof.yieldIndex, p.recipient, p.amount, ZERO, 0n],
                }),
              },
            ])
        flow.step(4)
        const receipt = await waitOk(hash)
        const stored = notes.notes.find((n) => n.note === parsed.raw)
        if (stored) notes.update(stored.commitment, { status: 'loan' })
        flow.done(createElement(DoneCard, { title: 'Loan sent', amount: p.amount - fee, to: p.recipient, txHash: receipt.transactionHash }))
      } catch (e) {
        flow.fail(e)
      }
    },
    [startFlow, relayParams, read, send, waitOk, notes],
  )

  // ---------------------------------------------------------------- repay

  const repay = useCallback(
    async (parsed: ParsedNote) => {
      const flow = startFlow('Repaying your loan', [
        'Loading the deposit tree',
        'Creating your renewed note',
        'Generating the zero-knowledge proof',
        'Signing the USDC authorization',
        config?.sponsoredGas ? 'Submitting (gas paid by Hushfund)' : 'Submitting from your wallet (you pay gas in ETH)',
        'Confirming on Ethereum',
      ])
      try {
        const { commitments } = await api.commitments(parsed.vault.address)
        flow.step(1)
        const fresh = await generateCommitment()
        const original = await noteHashes(parsed.note)
        const recoveryNote = encodeNote(fresh.commitment, fresh.nullifier, fresh.secret, parsed.note.yieldIndex, 'usdc', parsed.denomination, NOTE_NETWORK)
        await requireBackup({
          version: 1, chainId: 1, action: 'repay', vault: parsed.vault.address, denomination: parsed.denomination,
          draftNote: recoveryNote,
          replaces: original.commitment, createdAt: Math.floor(Date.now() / 1000),
        })
        const ext = await read<Hex>(parsed.vault.address, 'repayExtDataHash', [fresh.commitmentHex])
        flow.step(2)
        const proof = await generateProof('withdraw', parsed.note, commitments, ext)
        flow.step(3)
        const debt = await read<bigint>(parsed.vault.address, 'getDebt', [proof.collateralNullifierHash])
        if (debt === 0n) throw new Error('No active loan on this note.')
        // the debt grows every block; authorise 0.1% extra, the vault refunds whatever is not needed
        const authorised = debt + debt / 1000n + 1n
        const nonce = await read<Hex>(parsed.vault.address, 'repayNonce', [proof.collateralNullifierHash, fresh.commitmentHex])
        const auth = await signReceive(parsed.vault.address, authorised, nonce)
        flow.step(4)
        const hash = config?.sponsoredGas
          ? (
              await api.relayRepay({
                vault: parsed.vault.address,
                proof: proof.proof,
                root: proof.root,
                nullifierHash: proof.nullifierHash,
                collateralNullifierHash: proof.collateralNullifierHash,
                yieldIndex: proof.yieldIndex.toString(),
                newInnerCommitment: fresh.commitmentHex,
                auth,
              })
            ).txHash
          : await send([
              {
                to: parsed.vault.address,
                data: encodeFunctionData({
                  abi: vaultAbi,
                  functionName: 'repayWithAuthorization',
                  args: [proof.proof, proof.root, proof.nullifierHash, proof.collateralNullifierHash, proof.yieldIndex, fresh.commitmentHex as Hex, auth],
                }),
              },
            ])
        if (!await recordRecoveryTransaction(recoveryNote, hash)) toast('Transaction status could not be saved in this browser. Keep your recovery file; it still works after confirmation.')
        flow.step(5)
        const receipt = await waitOk(hash)
        if (receipt.transactionHash !== hash) await recordRecoveryTransaction(recoveryNote, receipt.transactionHash)

        const raw = encodeNote(fresh.commitment, fresh.nullifier, fresh.secret, parsed.note.yieldIndex, 'usdc', parsed.denomination, NOTE_NETWORK)
        const h = await noteHashes(decodeNote(raw))
        const old = notes.notes.find((n) => n.note === parsed.raw)
        if (old) notes.update(old.commitment, { status: 'renewed' })
        notes.add({
          note: raw,
          vault: parsed.vault.address,
          denomination: parsed.denomination,
          createdAt: old?.createdAt ?? Math.floor(Date.now() / 1000),
          commitment: h.commitment,
          nullifierHash: h.nullifierHash,
          collateralNullifierHash: h.collateralNullifierHash,
          yieldIndex: BigInt(bytesToHex(parsed.note.yieldIndex)).toString(),
          status: 'active',
        })
        flow.done(
          createElement(NoteModal, {
            title: 'Loan repaid: here is your renewed note',
            note: raw,
            intro: 'Your old note is now retired. This new note keeps the same deposit and yield, and it cannot be linked to the loan. Use it for future withdrawals.',
          }),
        )
        toast('Old note retired. Save the renewed note.')
      } catch (e) {
        flow.fail(e)
      }
    },
    [startFlow, read, signReceive, send, waitOk, notes, toast, config, requireBackup],
  )

  return { deposit, withdraw, bridge, borrow, repay, read }
}

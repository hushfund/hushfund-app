import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { mainnet } from 'viem/chains'

export interface WalletCall {
  to: Hex
  data: Hex
  value?: bigint
}

/** A cancellation/replacement can have a successful receipt without performing our action. */
export async function waitForConfirmedTransaction(
  client: Pick<PublicClient, 'waitForTransactionReceipt'>,
  hash: Hex,
) {
  let changedAction = false
  const receipt = await client.waitForTransactionReceipt({
    hash,
    timeout: 10 * 60_000,
    onReplaced: ({ reason }) => {
      if (reason !== 'repriced') changedAction = true
    },
  })
  if (changedAction) throw new Error('The transaction was cancelled or replaced with a different action. Check your wallet before trying again.')
  if (receipt.status !== 'success') throw new Error('The transaction reverted on-chain. No later transaction was sent.')
  return receipt
}

export async function assertMainnetWallet(
  wallet: Pick<WalletClient, 'getChainId' | 'getAddresses'>,
  expectedAccount: Address,
) {
  const [chainId, accounts] = await Promise.all([wallet.getChainId(), wallet.getAddresses()])
  if (chainId !== 1) throw new Error('Switch your wallet to Ethereum Mainnet, then try again.')
  if (accounts[0]?.toLowerCase() !== expectedAccount.toLowerCase()) {
    throw new Error('Your wallet account changed. Reconnect the intended account, then try again.')
  }
}

/** Never send the next call if the preceding call reverted, was cancelled, or changed. */
export async function sendWalletCalls(
  wallet: WalletClient,
  client: Pick<PublicClient, 'waitForTransactionReceipt'>,
  calls: WalletCall[],
): Promise<Hex> {
  if (!wallet.account) throw new Error('Sign in first')
  if (!calls.length) throw new Error('No transaction was requested.')
  let last: Hex = '0x'
  for (let i = 0; i < calls.length; i++) {
    await assertMainnetWallet(wallet, wallet.account.address)
    const call = calls[i]
    last = await wallet.sendTransaction({
      account: wallet.account,
      chain: mainnet,
      to: call.to,
      data: call.data,
      value: call.value ?? 0n,
    })
    if (i < calls.length - 1) await waitForConfirmedTransaction(client, last)
  }
  return last
}

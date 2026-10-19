import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vaultAbi } from '../contracts/vaultAbi.ts'
import { api, type AppConfig } from '../lib/api.ts'
import { publicClient } from '../lib/client.ts'
import { noteHashes } from '../zk/proof.ts'
import { parseNote, type ParsedNote } from './useActions.ts'

export interface NoteInfo {
  parsed: ParsedNote
  nullifierHash: `0x${string}`
  collateralNullifierHash: `0x${string}`
  spent: boolean
  loanActive: boolean
  debt: bigint
  principal: bigint
  payout: bigint // before fees
  protocolFee: bigint
  maxBorrow: bigint
  leafIndex: number | null
  depositedAt: number | null
  depositsAfter: number | null
}

/** Parses a note and reads its live state from the vault: spent, loan, value, position in the tree. */
export function useNoteInfo(raw: string, config: AppConfig | undefined) {
  const parsed = useMemo(() => {
    if (!raw.trim()) return { p: null as ParsedNote | null, error: null as string | null }
    try {
      return { p: parseNote(raw, config), error: null }
    } catch (e) {
      return { p: null, error: e instanceof Error ? e.message : 'Invalid note' }
    }
  }, [raw, config])

  const q = useQuery({
    queryKey: ['note', parsed.p?.raw],
    enabled: !!parsed.p,
    refetchInterval: 30_000,
    queryFn: async (): Promise<NoteInfo> => {
      const p = parsed.p!
      const h = await noteHashes(p.note)
      const vault = p.vault.address
      const r = <T,>(functionName: string, args: readonly unknown[] = []) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        publicClient.readContract({ address: vault, abi: vaultAbi, functionName: functionName as any, args: args as any }) as Promise<T>
      const [exists, spent, loan, debt, index, feeBps, commitments, stats] = await Promise.all([
        r<boolean>('s_commitments', [h.commitment]),
        r<boolean>('s_nullifierHashes', [h.nullifierHash]),
        r<readonly [bigint, bigint, bigint, boolean]>('s_loans', [h.collateralNullifierHash]),
        r<bigint>('getDebt', [h.collateralNullifierHash]),
        r<bigint>('getCurrentYieldIndex'),
        r<bigint>('s_withdrawalFeeBps'),
        api.commitments(vault),
        api.stats(vault),
      ])
      if (!exists) throw new Error('This note is not in the vault. Check that you copied all of it.')
      const den = BigInt(p.denomination) * 1_000_000n
      const payout = (den * index) / h.yieldIndex
      const leafIndex = commitments.commitments.findIndex((c) => c.toLowerCase() === h.commitment.toLowerCase())
      return {
        parsed: p,
        nullifierHash: h.nullifierHash,
        collateralNullifierHash: h.collateralNullifierHash,
        spent,
        loanActive: loan[3],
        principal: loan[0],
        debt,
        payout,
        protocolFee: (payout * feeBps) / 10_000n,
        maxBorrow: (payout * 7000n) / 10_000n,
        leafIndex: leafIndex >= 0 ? leafIndex : null,
        depositedAt: leafIndex >= 0 ? stats.leaves[leafIndex]?.timestamp ?? null : null,
        depositsAfter: leafIndex >= 0 ? commitments.commitments.length - 1 - leafIndex : null,
      }
    },
  })

  return { parseError: parsed.error, parsed: parsed.p, info: q.data, loading: q.isLoading && !!parsed.p, error: q.error?.message ?? null }
}

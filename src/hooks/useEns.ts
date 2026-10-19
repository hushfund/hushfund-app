import { useMemo } from 'react'
import { useEnsAddress, useEnsAvatar, useEnsText } from 'wagmi'
import { normalize } from 'viem/ens'
import { SUPPORTED_CHAINS, COMMON_TOKENS } from '../constants/chains.ts'

/** Resolves "0x…" or "name.eth" to an address. ENS is always read from Ethereum mainnet. */
export function useRecipient(input: string) {
  const v = input.trim()
  const isAddress = /^0x[0-9a-fA-F]{40}$/.test(v)
  const name = useMemo(() => {
    if (isAddress || !v.includes('.')) return undefined
    try {
      return normalize(v)
    } catch {
      return undefined
    }
  }, [v, isAddress])

  const addr = useEnsAddress({ name, chainId: 1, query: { enabled: !!name } })
  const avatar = useEnsAvatar({ name, chainId: 1, query: { enabled: !!name && !!addr.data } })
  // ENS text records let a recipient publish where they want funds: hushfund.chain = "10", hushfund.token = "USDC"
  const prefChain = useEnsText({ name, key: 'hushfund.chain', chainId: 1, query: { enabled: !!name && !!addr.data } })
  const prefToken = useEnsText({ name, key: 'hushfund.token', chainId: 1, query: { enabled: !!name && !!addr.data } })

  const chain = prefChain.data ? SUPPORTED_CHAINS.find((c) => c.chainId === Number(prefChain.data)) ?? null : null
  const token =
    chain && prefToken.data
      ? COMMON_TOKENS[chain.chainId]?.find((t) => t.symbol.toLowerCase() === prefToken.data!.toLowerCase()) ?? null
      : null

  if (isAddress) return { address: v as `0x${string}`, ens: null, avatar: null, loading: false, notFound: false, invalid: false, chain: null, token: null }
  if (!v) return { address: null, ens: null, avatar: null, loading: false, notFound: false, invalid: false, chain: null, token: null }
  if (!name) return { address: null, ens: null, avatar: null, loading: false, notFound: false, invalid: true, chain: null, token: null }
  return {
    address: (addr.data ?? null) as `0x${string}` | null,
    ens: addr.data ? name : null,
    avatar: avatar.data ?? null,
    loading: addr.isLoading,
    notFound: !addr.isLoading && !addr.data,
    invalid: false,
    chain,
    token,
  }
}

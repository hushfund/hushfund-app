import { useQuery } from '@tanstack/react-query'
import { useReadContract } from 'wagmi'
import { api, type AppConfig, type VaultStats } from '../lib/api.ts'
import { CHAIN } from '../lib/env.ts'
import { usdcAbi } from '../contracts/usdc.ts'

export function useAppConfig() {
  return useQuery({ queryKey: ['config'], queryFn: api.config, staleTime: 5 * 60_000, retry: 2 })
}

export function useAllVaultStats(config: AppConfig | undefined) {
  const result = useQuery({
    queryKey: ['stats', 'all'],
    queryFn: api.allStats,
    enabled: !!config?.vaults.length,
    refetchInterval: 15_000,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
  })
  const byVault = new Map<string, VaultStats>()
  result.data?.vaults?.forEach((vault) => {
    byVault.set(vault.address.toLowerCase(), vault)
  })
  const isComplete = !!config?.vaults.length && config.vaults.every(v => {
    const value = byVault.get(v.address.toLowerCase())?.totalAssets
    return typeof value === 'string' && /^\d+$/.test(value)
  })
  return {
    byVault, isComplete, isLoading: result.isLoading, isError: result.isError || (!!result.data && !isComplete),
    isFetching: result.isFetching, asOfBlock: result.data?.asOfBlock,
    updatedAt: result.data?.updatedAt,
    isStale: result.isError || (!!result.data && (!isComplete || Date.now() - Date.parse(result.data.updatedAt) > 60_000)),
  }
}

export function useApy(vault: string | undefined) {
  return useQuery({
    queryKey: ['apy', vault],
    queryFn: () => api.apy(vault!),
    enabled: !!vault,
    staleTime: 10 * 60_000,
  })
}

export function useUsdcBalance(usdc: `0x${string}` | undefined, owner: `0x${string}` | undefined) {
  const r = useReadContract({
    address: usdc,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    chainId: CHAIN.id,
    query: { enabled: !!usdc && !!owner, refetchInterval: 20_000 },
  })
  return { balance: r.data as bigint | undefined, refetch: r.refetch }
}

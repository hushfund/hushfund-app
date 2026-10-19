import { API_URL } from './env.ts'

export interface VaultInfo {
  denominationUsdc: number
  address: `0x${string}`
}

export interface AppConfig {
  network: string
  chainId: number
  explorer: string
  usdc: `0x${string}`
  deployBlock: number
  vaults: VaultInfo[]
  relayer: `0x${string}` | null
  /** the relayer submits deposits and repayments, so users need no ETH */
  sponsoredGas: boolean
  /** withdraw/borrow relayer fee is 0 */
  sponsoredFees: boolean
}

export interface VaultStats {
  aaveAssets: string
  idleAssets: string
  totalAssets: string
  asOfBlock: string
  updatedAt: string
  commitmentCount: number
  morphoAssets: string
  denomination: string
  feeBps: string
  yieldIndex: string
  bucketedYieldIndex: string
  deposits: number
  totalBorrowed: string
  paused: boolean
  leaves: { leafIndex: number; timestamp: number; commitment: `0x${string}`; yieldIndex: string; kind?: 'deposit' | 'renewal' }[]
}

export interface LoanInfo {
  active: boolean
  collateralSpent: boolean
  principalAmount: string
  borrowYieldIndex: string
  depositYieldIndex: string
  debt: string
}

export interface RelayQuote {
  relayer: `0x${string}`
  fee: string
  gasLimit: string
  ethUsd: number
  maxFeePerGas: string
  validUntil: number
}

export interface Apy {
  status: 'available' | 'insufficient_history' | 'historical_unavailable'
  message: string
  aave: number | null
  morpho: number | null
  blended: number | null
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API_URL}${path}`)
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error ?? `Request failed (${r.status})`)
  return data as T
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error ?? `Request failed (${r.status})`)
  return data as T
}

export const api = {
  config: () => get<AppConfig>('/api/config'),
  commitments: (vault: string) => get<{ commitments: string[] }>(`/api/vault/commitments?vault=${vault}`),
  stats: (vault: string) => get<VaultStats>(`/api/vault/stats?vault=${vault}`),
  allStats: () => get<{
    asOfBlock: string
    updatedAt: string
    totalAssets: string
    vaults: (VaultStats & { address: string })[]
  }>('/api/vault/stats/all'),
  apy: (vault: string) => get<Apy>(`/api/vault/apy?vault=${vault}`),
  loan: (vault: string, collateralNullifierHash: string) =>
    get<LoanInfo>(`/api/vault/loan?vault=${vault}&collateralNullifierHash=${collateralNullifierHash}`),
  quote: (action: 'withdraw' | 'borrow') => get<RelayQuote>(`/api/relay/quote?action=${action}`),
  relayWithdraw: (body: Record<string, string>) => post<{ txHash: `0x${string}` }>('/api/relay/withdraw', body),
  relayBorrow: (body: Record<string, string>) => post<{ txHash: `0x${string}` }>('/api/relay/borrow', body),
  relayDeposit: (body: Record<string, string>) => post<{ txHash: `0x${string}` }>('/api/relay/deposit', body),
  relayRepay: (body: Record<string, string>) => post<{ txHash: `0x${string}` }>('/api/relay/repay', body),
}

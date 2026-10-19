import { SOURCE_CHAIN_ID } from '../constants/chains.ts'

const LIFI_API = 'https://li.quest/v1'

export interface LiFiQuote {
  transactionRequest: { to: string; data: string; value: string; gasLimit?: string; chainId: number }
  estimate: {
    toAmount: string
    toAmountMin: string
    executionDuration: number
    approvalAddress?: string
    feeCosts?: Array<{ amountUSD?: string }>
    gasCosts?: Array<{ amountUSD?: string }>
  }
  action: {
    fromChainId: number; toChainId: number; fromAmount: string
    fromAddress: string; toAddress: string
    fromToken: { address: string }
    toToken: { address: string; symbol: string; decimals: number }
  }
}

type QuoteRequest = {
  fromAmount: string; fromAddress: string; toAddress: string; toChainId: number
  toToken: string; fromToken: string; signal?: AbortSignal
}

/** Check the route before granting any token allowance to an external service. */
export function validateLiFiQuote(data: LiFiQuote, p: QuoteRequest): LiFiQuote {
  const address = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v) && !/^0x0{40}$/i.test(v)
  const equal = (a: unknown, b: string) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase()
  const tx = data?.transactionRequest
  const action = data?.action
  if (!tx || tx.chainId !== SOURCE_CHAIN_ID || !address(tx.to) ||
      typeof tx.data !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(tx.data) ||
      typeof tx.value !== 'string' || !/^(?:0x[0-9a-fA-F]+|[0-9]+)$/.test(tx.value) ||
      !action || action.fromChainId !== SOURCE_CHAIN_ID || action.toChainId !== p.toChainId ||
      action.fromAmount !== p.fromAmount ||
      !equal(action.fromAddress, p.fromAddress) || !equal(action.toAddress, p.toAddress) ||
      !equal(action.fromToken?.address, p.fromToken) || !equal(action.toToken?.address, p.toToken) ||
      !data.estimate || (data.estimate.approvalAddress !== undefined && !address(data.estimate.approvalAddress))) {
    throw new Error('The bridge quote does not match your request. No approval or transaction was sent.')
  }
  return data
}

/** Quote for bridging USDC from Ethereum to another chain/token, delivered straight to `toAddress`. */
export async function lifiQuote(p: QuoteRequest): Promise<LiFiQuote> {
  const params = new URLSearchParams({
    fromChain: String(SOURCE_CHAIN_ID),
    toChain: String(p.toChainId),
    fromToken: p.fromToken,
    toToken: p.toToken,
    fromAmount: p.fromAmount,
    fromAddress: p.fromAddress,
    toAddress: p.toAddress,
    integrator: 'hushfund',
  })
  const r = await fetch(`${LIFI_API}/quote?${params}`, { signal: p.signal })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.message ?? `LI.FI quote failed (${r.status})`)
  return validateLiFiQuote(data as LiFiQuote, p)
}

export function bridgeDelivered(s: { status?: string; substatus?: string }): boolean {
  if (s.status === 'FAILED') throw new Error('The bridge failed. Check the transaction on scan.li.fi before sending again.')
  if (s.status !== 'DONE') return false
  if (s.substatus !== 'COMPLETED') {
    throw new Error('The bridge did not deliver the full requested transfer. Check refunds or partial delivery on scan.li.fi before sending again.')
  }
  return true
}

/** Polls LI.FI until the bridge transfer lands on the destination chain (up to ~15 minutes). */
export async function lifiWaitForBridge(txHash: string): Promise<void> {
  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    const r = await fetch(`${LIFI_API}/status?txHash=${txHash}&fromChain=${SOURCE_CHAIN_ID}`)
    if (!r.ok) continue
    const s = (await r.json()) as { status?: string; substatus?: string }
    if (bridgeDelivered(s)) return
  }
  throw new Error('Bridge is taking longer than 15 minutes. Track it on scan.li.fi.')
}

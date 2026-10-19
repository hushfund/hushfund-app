export const fmt = (n: number, d = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
export const money = (n: number, d = 2) => '$' + fmt(n, d)
export const usdc = (units: bigint | string | number) => Number(BigInt(units)) / 1e6
export const shortHex = (h: string, a = 6, b = 4) => (h.length > a + b + 2 ? `${h.slice(0, a)}…${h.slice(-b)}` : h)
export const sDate = (sec: number) =>
  new Date(sec * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function ago(sec: number, now = Date.now() / 1000) {
  const s = now - sec
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 365) return `${Math.floor(s / 86400)}d ago`
  return `${(s / 86400 / 365).toFixed(1)}y ago`
}

export const RAY = 10n ** 27n

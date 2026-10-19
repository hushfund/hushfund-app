import { useMemo, useState } from 'react'
import { CountUp, Head, Icon } from '../components/ui.tsx'
import { useAllVaultStats, useApy, useAppConfig } from '../hooks/useVaultData.ts'
import { useNotes } from '../hooks/useNotes.tsx'
import { RAY, money, sDate } from '../lib/format.ts'
import { formatTvl, sumTvl } from '../lib/tvl.ts'
import type { VaultStats } from '../lib/api.ts'

const COLORS = [
  ['#5b7cfa', '#86a6ff'],
  ['#f2a65a', '#f7cf7e'],
  ['#2fc79a', '#86e8c7'],
  ['#9b7bf7', '#c7b0ff'],
  ['#f472b6', '#f9a8d4'],
  ['#38bdf8', '#7dd3fc'],
]
const DAY = 86_400

const usd = (s: string | bigint | undefined) => (s === undefined ? 0 : Number(BigInt(s)) / 1e6)
const tvlOf = (s?: VaultStats) => usd(s?.totalAssets)

export function Dashboard({ go }: { go: (to: string) => void }) {
  const { data: config, error } = useAppConfig()
  const { byVault, isStale } = useAllVaultStats(config)
  const { notes } = useNotes()
  const [filter, setFilter] = useState<'all' | number>('all')
  const vaults = config?.vaults ?? []
  const shown = filter === 'all' ? vaults : vaults.filter((v) => v.denominationUsdc === filter)
  const apy = useApy(shown[0]?.address)

  const stat = (addr: string) => byVault.get(addr.toLowerCase())
  const tvlUnits = sumTvl(shown.map(v => stat(v.address)?.totalAssets))
  const tvlReady = tvlUnits !== undefined
  const aaveUnits = sumTvl(shown.map(v => stat(v.address)?.aaveAssets))
  const morphoUnits = sumTvl(shown.map(v => stat(v.address)?.morphoAssets))
  const lentUnits = sumTvl(shown.map(v => stat(v.address)?.totalBorrowed))
  const idleUnits = sumTvl(shown.map(v => stat(v.address)?.idleAssets))
  const aave = Number(aaveUnits ?? 0n) / 1e6
  const morpho = Number(morphoUnits ?? 0n) / 1e6
  const lent = Number(lentUnits ?? 0n) / 1e6
  const idle = Number(idleUnits ?? 0n) / 1e6

  const active = notes.filter((n) => n.status === 'active' || n.status === 'loan')
  const myValue = active.reduce((s, n) => {
    const st = stat(n.vault)
    return s + (st ? (n.denomination * Number((BigInt(st.yieldIndex) * 1_000_000n) / BigInt(n.yieldIndex))) / 1e6 : n.denomination)
  }, 0)
  const myPrincipal = active.reduce((s, n) => s + n.denomination, 0)
  const myPct = myPrincipal ? (myValue / myPrincipal - 1) * 100 : 0
  const loans = notes.filter((n) => n.status === 'loan').length

  // spectrum: one bar per day (30 days); height = USDC deposited that day
  const series = useMemo(() => {
    const now = Date.now() / 1000
    const per = vaults.map((v) => {
      const arr = Array(30).fill(0) as number[]
      for (const l of stat(v.address)?.leaves ?? []) {
        if (l.kind !== 'deposit') continue
        const k = 29 - Math.floor((now - l.timestamp) / DAY)
        if (k >= 0 && k < 30) arr[k] += v.denominationUsdc
      }
      return arr
    })
    const mine = Array(30).fill(0) as number[]
    for (const n of active) {
      const k = 29 - Math.floor((now - n.createdAt) / DAY)
      if (k >= 0 && k < 30) mine[k] += n.denomination
    }
    return { per, mine, max: Math.max(1, ...per.flat(), ...mine) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaults, byVault, active.length])

  const bars = (arr: number[]) => (
    <span className="bars" aria-hidden="true">
      {arr.map((x, j) => (
        <i key={j} className={x ? '' : 'z'} style={{ ['--h' as string]: `${x ? Math.max(8, Math.sqrt(x / series.max) * 100) : 5}%`, ['--j' as string]: j }} />
      ))}
    </span>
  )

  const segs: [string, number, string][] = [
    ['Aave V3', aave, COLORS[0][0]],
    ['Morpho', morpho, COLORS[3][0]],
    ['Lent out', lent, '#f5f5f4'],
    ['Idle USDC', idle, '#83838c'],
  ]
  const segTotal = aave + morpho + lent + idle || 1

  // anonymity dots
  const now = Date.now() / 1000
  const counts = Array(30).fill(0) as number[]
  for (const v of shown) for (const l of stat(v.address)?.leaves ?? []) {
    if (l.kind !== 'deposit') continue
    const k = 29 - Math.floor((now - l.timestamp) / DAY)
    if (k >= 0 && k < 30) counts[k]++
  }
  const rowsN = 9
  const mx = Math.max(...counts, 1)
  const sc = mx > rowsN ? rowsN / mx : 1
  const anon = shown.reduce((s, v) => s + (stat(v.address)?.deposits ?? 0), 0)

  // recent activity: deposits (anonymous) plus the user's own notes
  const rows = useMemo(() => {
    const r: { you: boolean; who: string; sub: string; desc: string; t: number; amt: string; c: string }[] = []
    shown.forEach((v) => {
      const ci = vaults.indexOf(v) % COLORS.length
      for (const l of stat(v.address)?.leaves ?? []) r.push({ you: false, who: 'Anonymous', sub: `leaf #${l.leafIndex}`, desc: `${l.kind === 'deposit' ? 'Deposit' : l.kind === 'renewal' ? 'Note renewed' : 'Note issued'} · ${v.denominationUsdc} USDC`, t: l.timestamp, amt: `${l.kind === 'deposit' ? '+' : ''}${money(v.denominationUsdc)}`, c: COLORS[ci][0] })
    })
    return r.sort((a, b) => b.t - a.t).slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, byVault])

  const yi = shown[0] ? stat(shown[0].address)?.yieldIndex : undefined

  return (
    <>
      {error && (
        <p className="warnbox" role="status">
          Vault data is unavailable. Connect the Hushfund backend to load balances and activity.
        </p>
      )}
      <section className="kpis" style={{ ['--i' as string]: 0 }}>
        <div className="kpi">
          <span className="lab">Total Value Locked {isStale && <span style={{ color: 'var(--warn)' }}>· Stale</span>}</span>
          <div className="val">
            <span className="big num" title={isStale ? 'Stale snapshot. Refreshing vault data.' : 'Aave + Morpho + idle USDC + outstanding loan principal; unpaid loan interest is not estimated.'}>{tvlReady ? formatTvl(tvlUnits) : '—'}</span>
            <span className="bd up">{apy.data?.blended != null ? `+${apy.data.blended.toFixed(2)}% APY` : 'APY —'}</span>
          </div>
        </div>
        <div className="kpi">
          <span className="lab">Your Notes</span>
          <div className="val">
            <span className="big num"><CountUp value={myValue} prefix="$" /></span>
            <span className={`bd ${myPct > 0 ? 'up' : 'flat'}`}>+{myPct.toFixed(2)}%</span>
          </div>
        </div>
        <div className="kpi">
          <span className="lab">Lent from the vaults</span>
          <div className="val">
            <span className="big num">{lentUnits !== undefined ? formatTvl(lentUnits) : '—'}</span>
            <span className={`bd ${loans ? 'down' : 'flat'}`}>{loans} of yours</span>
          </div>
        </div>
        <div className="kact">
          <button className="ghost" onClick={() => go('deposit')}>
            <Icon name="in" size={15} />
            New deposit
          </button>
        </div>
      </section>

      <section className={`strip${filter !== 'all' ? ' dimmed' : ''}`} style={{ ['--i' as string]: 1 }} aria-label="Vaults">
        {vaults.map((v, k) => {
          const st = stat(v.address)
          const c = COLORS[k % COLORS.length]
          return (
            <button key={v.address} className={`seg${filter === v.denominationUsdc ? ' on' : ''}`} onClick={() => setFilter(v.denominationUsdc)}
              style={{ flexGrow: Math.max(Math.sqrt(tvlOf(st)), 6), ['--c1' as string]: c[0], ['--c2' as string]: c[1], ['--k' as string]: k }}>
              <span className="sl">{v.denominationUsdc.toLocaleString()} USDC Vault</span>
              <span className="sv">{st && /^\d+$/.test(st.totalAssets) ? formatTvl(BigInt(st.totalAssets)) : <span className="skeleton">—</span>}</span>
              <span className="cnt">{st?.deposits ?? '—'} deposits</span>
              {bars(series.per[k] ?? [])}
            </button>
          )
        })}
        <button className="seg" onClick={() => go('notes')} style={{ flexGrow: Math.max(Math.sqrt(myValue), 6), ['--c1' as string]: '#d9f24b', ['--c2' as string]: '#eef9a8', ['--k' as string]: vaults.length }}>
          <span className="sl">Your Notes</span>
          <span className="sv">{money(myValue)}</span>
          <span className="cnt">{active.length} active</span>
          {bars(series.mine)}
        </button>
      </section>

      <div className="chiprow" style={{ ['--i' as string]: 2 }}>
        <div className="chips">
          <button className={`chip${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>All</button>
          {vaults.map((v) => (
            <button key={v.address} className={`chip${filter === v.denominationUsdc ? ' on' : ''}`} onClick={() => setFilter(v.denominationUsdc)}>
              {v.denominationUsdc.toLocaleString()} USDC
            </button>
          ))}
        </div>
        <div className="clock">
          <span className="small">Aave {apy.data?.aave?.toFixed(2) ?? '—'}% · Morpho {apy.data?.morpho?.toFixed(2) ?? '—'}%{apy.data?.status !== 'available' && apy.data?.message ? ` · ${apy.data.message}` : ''}</span>
        </div>
      </div>

      <div className="dgrid">
        <div className="dcol">
          <section className="card" style={{ ['--i' as string]: 3 }}>
            <Head title="Vault allocation" value={<p className="big num">{tvlReady ? formatTvl(tvlUnits) : '—'}</p>} to="deposit" onGo={go} />
            <div className="alloc">
              {segs.map(([label, val, col], k) => {
                const p = (val / segTotal) * 100
                return (
                  <div key={label} className="aseg" style={{ flexGrow: Math.max(p, 6) }}>
                    <span className="ap num">{config ? `${p > 0 && p < 1 ? '<1' : Math.round(p)}%` : '—'}</span>
                    <span className="tick" />
                    <span className="abar" style={{ background: col, ['--k' as string]: k }} />
                  </div>
                )
              })}
            </div>
            <div className="legend">
              {segs.map(([label, , col]) => (
                <span key={label}><i style={{ background: col }} />{label}</span>
              ))}
            </div>
          </section>

          <section className="card" style={{ ['--i' as string]: 4 }}>
            <Head title="Recent activity" to="activity" onGo={go} large />
            <div className="tw">
              <table>
                <thead><tr><th>User</th><th>Description</th><th>Created</th><th className="r">Amount</th></tr></thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={4} className="small">{tvlReady ? 'No note events yet.' : 'Waiting for Ethereum Mainnet activity data.'}</td></tr>}
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td><div className="who"><span className="av" style={{ background: r.c }}>?</span><div>{r.who}<small>{r.sub}</small></div></div></td>
                      <td>{r.desc}</td>
                      <td>{sDate(r.t)}</td>
                      <td className="r">{r.amt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="dcol">
          <section className="card" style={{ ['--i' as string]: 5 }}>
            <Head title="Anonymity set" value={<p className="big num">{tvlReady ? anon.toLocaleString() : '—'}<span className="unit"> equal deposits</span></p>} to="notes" onGo={go} />
            <div className="dots" role="img" aria-label="Deposits per day over the last 30 days">
              {Array.from({ length: rowsN }).flatMap((_, ri) => {
                const r = rowsN - 1 - ri
                return counts.map((cnt, c) => {
                  const h = Math.max(cnt ? 1 : 0, Math.round(cnt * sc))
                  return <span key={`${r}-${c}`} className={`dt${h > r ? ' f' : ''}`} style={{ ['--c' as string]: c }} />
                })
              })}
            </div>
            <div className="dlab num">
              <span>{sDate(now - 29 * DAY)}</span>
              <span>{config ? counts.reduce((a, b) => a + b, 0) : '—'} deposits in 30 days</span>
              <span>{sDate(now)}</span>
            </div>
            <div>
              <div className="src"><img className="plogo" src="/partners/aave.png" alt="" width={34} height={34} /><div className="lbl"><b>Aave V3</b><span>Supply APY {apy.data?.aave?.toFixed(2) ?? '—'}%</span></div><span className="v">{aaveUnits !== undefined ? formatTvl(aaveUnits) : '—'}</span></div>
              <div className="src"><img className="plogo" src="/partners/morpho.png" alt="" width={34} height={34} /><div className="lbl"><b>Morpho</b><span>Vault APY {apy.data?.morpho?.toFixed(2) ?? '—'}%</span></div><span className="v">{morphoUnits !== undefined ? formatTvl(morphoUnits) : '—'}</span></div>
              <div className="src"><span className="rb"><Icon name="pct" size={15} /></span><div className="lbl"><b>Yield index</b><span>Blended Aave + Morpho, since launch</span></div><span className="v">{yi ? (Number((BigInt(yi) * 100_000n) / RAY) / 100_000).toFixed(5) : '—'}</span></div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

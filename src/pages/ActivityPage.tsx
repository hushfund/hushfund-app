import { Head, Icon } from '../components/ui.tsx'
import { useAllVaultStats, useAppConfig } from '../hooks/useVaultData.ts'
import { EXPLORER } from '../lib/env.ts'
import { ago, sDate } from '../lib/format.ts'

/** Public view of every vault: what anyone can see on-chain, and what they cannot. */
export function ActivityPage({ go }: { go: (to: string) => void }) {
  const { data: config } = useAppConfig()
  const { byVault, isStale } = useAllVaultStats(config)
  const hasSnapshot = !!config?.vaults.length && config.vaults.every(v => byVault.has(v.address.toLowerCase()))
  const rows = (config?.vaults ?? [])
    .flatMap((v) => (byVault.get(v.address.toLowerCase())?.leaves ?? []).map((l) => ({ ...l, v })))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50)

  return (
    <div className="dgrid">
      <section className="card" style={{ ['--i' as string]: 0 }}>
        <Head title="Vault activity" value={<p className="big num">{hasSnapshot ? rows.length : '—'}<span className="unit"> latest notes</span></p>} to="dashboard" onGo={go} />
        {isStale && <p className="small" role="status">Stale Mainnet snapshot. Refreshing activity data.</p>}
        <div className="tw">
          <table>
            <thead><tr><th>Vault</th><th>Event</th><th>Leaf</th><th>When</th><th className="r">Date</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="small">{hasSnapshot ? 'No note events available.' : 'Waiting for Ethereum Mainnet activity data.'}</td></tr>}
              {rows.map((r) => (
                <tr key={`${r.v.address}-${r.leafIndex}`}>
                  <td>{r.v.denominationUsdc.toLocaleString()} USDC</td>
                  <td>{r.kind === 'deposit' ? 'Deposit' : r.kind === 'renewal' ? 'Note renewed' : 'Note issued'}</td>
                  <td className="mono">#{r.leafIndex}</td>
                  <td>{ago(r.timestamp)}</td>
                  <td className="r">{sDate(r.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card" style={{ ['--i' as string]: 1 }}>
        <Head title="Contracts" value={<p className="big">{config?.vaults.length ?? '—'}<span className="unit"> vaults</span></p>} />
        <div>
          {(config?.vaults ?? []).map((v) => (
            <div className="src" key={v.address}>
              <span className="rb"><Icon name="shield" size={15} /></span>
              <div className="lbl"><b>{v.denominationUsdc.toLocaleString()} USDC vault</b><span className="mono">{v.address}</span></div>
              <a className="txlink" href={`${EXPLORER}/address/${v.address}`} target="_blank" rel="noreferrer">Etherscan</a>
            </div>
          ))}
        </div>
        <p className="small" style={{ margin: 0, lineHeight: 1.6 }}>
          Deposits publish a wallet and commitment. Withdrawal events publish a nullifier and recipient, not the original note secret. Loans and repayments share a collateral hash; repayment creates a renewed note. Public amounts and timing can still reveal patterns.
        </p>
      </section>
    </div>
  )
}

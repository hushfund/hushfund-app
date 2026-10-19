import { useBlockNumber, useGasPrice } from 'wagmi'
import { useAllVaultStats, useAppConfig } from '../hooks/useVaultData.ts'
import { CHAIN } from '../lib/env.ts'
import { LINKS } from '../lib/links.ts'
import { formatTvl, sumTvl } from '../lib/tvl.ts'

/** One-line status bar fixed to the bottom of every page: network, live stats and links. */
export function Footer({ onDocs, onGuide }: { onDocs: () => void; onGuide: () => void }) {
  const { data: config, error: configError } = useAppConfig()
  const { byVault, isComplete, isStale, isError, asOfBlock, updatedAt } = useAllVaultStats(config)
  const { data: block } = useBlockNumber({ chainId: CHAIN.id, watch: true })
  const { data: gas } = useGasPrice({ chainId: CHAIN.id, query: { refetchInterval: 15_000 } })

  const tvl = sumTvl((config?.vaults ?? []).map(v => byVault.get(v.address.toLowerCase())?.totalAssets))
  let deposits = 0
  byVault.forEach((s) => {
    deposits += s.deposits
  })
  const gwei = gas !== undefined ? Number(gas) / 1e9 : null

  return (
    <footer className="foot" aria-label="Network status and links">
      <div className="wrap footin">
        <span className="fnet">
          <i />
          Ethereum Mainnet
          {block !== undefined && <span className="fdim num">#{block.toLocaleString()}</span>}
        </span>
        <span className="fsep" />
        <span
          className={`fstat ftvl${isStale ? ' is-stale' : ''}`}
          aria-live="polite"
          aria-atomic="true"
          title={tvl === undefined
            ? (isError || configError ? 'TVL unavailable. Retrying on the next update.' : 'Loading all vaults; incomplete data is not counted as zero.')
            : `${isStale ? 'Stale snapshot' : 'Live snapshot'} · block ${asOfBlock} · ${updatedAt ? new Date(updatedAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : ''}. Includes Aave, Morpho, idle USDC and outstanding loan principal. Unpaid loan interest is not estimated. USDC is displayed at $1.`}
        >
          <span className="fdim">TVL</span> <b className="num">{tvl !== undefined ? formatTvl(tvl) : '—'}</b>
          {isStale && tvl !== undefined && <span className="fstatus">Stale</span>}
        </span>
        <span className="fstat fdeposits" title="Cumulative on-chain Deposit events. Replacement notes issued after repayment are excluded."><span className="fdim">Deposits</span> <b className="num">{isComplete ? deposits.toLocaleString('en-US') : '—'}</b></span>
        <span className="fstat fopt"><span className="fdim">Gas</span> <b className="num">{gwei === null ? '—' : `${gwei < 10 ? gwei.toFixed(2) : gwei.toFixed(0)} gwei`}</b></span>
        <span className="fstat fopt"><span className="fdim">Vaults</span> <b className="num">{config?.vaults.length ?? '—'}</b></span>
        <nav className="flinks" aria-label="Resources">
          <a
            href={LINKS.docs}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
              e.preventDefault()
              onDocs()
            }}
          >
            Docs
          </a>
          <button type="button" className="flink-btn" onClick={onGuide} aria-haspopup="dialog">Guide</button>
          <a href={LINKS.x} target="_blank" rel="noreferrer" aria-label="Hushfund on X">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
          </a>
        </nav>
      </div>
    </footer>
  )
}

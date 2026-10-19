import { useEffect, useState } from 'react'
import { useAppConfig } from '../hooks/useVaultData.ts'
import { EXPLORER } from '../lib/env.ts'
import './docs.css'

const SECTIONS: [string, string][] = [
  ['overview', 'Overview'],
  ['network', 'Network and USDC'],
  ['signin', 'Sign-in and wallet'],
  ['notes', 'Notes and backups'],
  ['deposit', 'Deposit'],
  ['proofs', 'Local ZK proofs'],
  ['withdraw', 'Withdraw'],
  ['borrow', 'Borrow'],
  ['repay', 'Repay'],
  ['yield', 'Yield strategies'],
  ['fees', 'Fees, rounding and gas'],
  ['transactions', 'Transactions and recovery'],
  ['storage', 'Browser storage'],
  ['contracts', 'Public contracts'],
  ['privacy', 'Privacy limits'],
  ['risks', 'Risks'],
  ['troubleshooting', 'Troubleshooting'],
  ['faq', 'FAQ'],
]

const FAQ: [string, string][] = [
  ['Can I deposit a custom amount?', 'No. Only 10, 50, 100 and 1000 USDC are supported. Fixed sizes are what make deposits indistinguishable from one another.'],
  ['Is my yield guaranteed?', 'No. Yield comes from Aave and Morpho lending markets and changes with their conditions. It can fall to near zero, and losses in those protocols would affect the vault.'],
  ['Is Hushfund anonymous?', 'It reduces on-chain linkability between deposits and withdrawals. It does not make you anonymous. Timing, amounts, recipients, network metadata and your own behaviour can all reveal links.'],
  ['Can support recover my note?', 'No. Notes are generated in your browser and never sent to a server. Without the note or an encrypted backup plus its password, the deposit cannot be withdrawn.'],
  ['Can the operator freeze my withdrawal?', 'The owner can pause new deposits and new loans. The contract does not allow pausing withdrawals or repayments. The owner can change the protocol fee (capped at 1%) and propose a strategy migration with a 2-day delay.'],
  ['Does my sign-in account own my deposit?', 'No. The note owns the deposit. Your sign-in only controls the wallet that funds deposits or receives payouts.'],
  ['Which networks are supported?', 'Ethereum Mainnet only. Notes, backups and proofs are bound to mainnet and to a specific vault.'],
]

function Sec({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="dc-sec" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}><a href={`#${id}`} className="dc-anchor" aria-hidden="true" tabIndex={-1}>#</a>{title}</h2>
      {children}
    </section>
  )
}

export function DocsPage({ onGuide, onLaunch }: { onGuide: () => void; onLaunch: () => void }) {
  const { data: config, isLoading, isError, refetch } = useAppConfig()
  const [active, setActive] = useState('overview')
  const explorer = (config?.explorer || EXPLORER).replace(/\/$/, '')

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Docs · Hushfund'
    const description = 'Learn how Hushfund works on Ethereum Mainnet: private USDC notes, deposits, withdrawals, borrowing, repayment, Aave and Morpho, recovery, fees and risks.'
    const restoreMetadata = [
      ['name', 'description', description],
      ['property', 'og:title', 'Docs · Hushfund'],
      ['property', 'og:description', description],
    ].map(([attribute, value, content]) => {
      const existing = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${value}"]`)
      const meta = existing ?? document.createElement('meta')
      const previous = meta.getAttribute('content')
      meta.setAttribute(attribute, value)
      meta.content = content
      if (!existing) document.head.append(meta)
      return () => {
        if (!existing) meta.remove()
        else if (previous === null) meta.removeAttribute('content')
        else meta.content = previous
      }
    })
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-20% 0px -70% 0px' },
    )
    document.querySelectorAll('.dc-sec').forEach((s) => io.observe(s))
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView()
    return () => { io.disconnect(); document.title = previousTitle; restoreMetadata.forEach(restore => restore()) }
  }, [])

  return (
    <div className="dc">
      <header className="dc-hero">
        <p className="dc-kicker">Documentation</p>
        <h1>How Hushfund works, and where it can fail.</h1>
        <p className="dc-lede">A reference for depositing, withdrawing, borrowing and repaying with private notes on Ethereum Mainnet. Read the risks section before you move money.</p>
        <div className="dc-cta">
          <button className="dc-btn lime" onClick={onGuide} aria-haspopup="dialog">Open the step-by-step guide</button>
          <button className="dc-btn" onClick={onLaunch}>Go to the app</button>
        </div>
      </header>

      <div className="dc-grid">
        <nav className="dc-toc" aria-label="Documentation sections">
          <p className="dc-toc-h">On this page</p>
          <ol>
            {SECTIONS.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className={active === id ? 'on' : ''} aria-current={active === id ? 'location' : undefined}>{label}</a></li>
            ))}
          </ol>
        </nav>

        <article className="dc-body">
          <Sec id="overview" title="Overview">
            <p>Hushfund is a fixed-denomination private vault for USDC. Each deposit creates a <b>note</b>: a secret string generated in your browser. The vault stores only a commitment (a hash) of that note in a Merkle tree. Later, you prove with a zero-knowledge proof that you know a note in the tree, without revealing which one.</p>
            <p>While deposited, funds are supplied to Aave and a Morpho vault and earn variable yield. You can withdraw a note once, or borrow against it and later repay.</p>
            <div className="dc-callout">The note is the only key to a deposit. Losing it means losing the funds. Sharing it means giving the funds away.</div>
          </Sec>

          <Sec id="network" title="Network and USDC">
            <ul>
              <li><b>Ethereum Mainnet only.</b> Other chains, testnets and L2s are not supported. Notes and backups are bound to chain ID 1.</li>
              <li><b>Native USDC only.</b> Deposits use Circle’s USDC token on Ethereum. Bridged or wrapped variants are not accepted.</li>
              <li><b>Fixed denominations:</b> 10, 50, 100 and 1000 USDC. Each denomination is a separate vault contract. <b>Custom amounts are not supported.</b></li>
            </ul>
            <p><b>Live TVL:</b> the app sums Aave asset balances, the USDC value of Morpho shares, idle USDC and outstanding loan principal across the four vaults at the same Ethereum block. Unpaid loan interest is not estimated. This is gross backing value, not immediately withdrawable liquidity or cumulative deposits. Dollar displays assume 1 USDC = $1; no external USDC/USD price feed is used.</p>
            <p>Values refresh every 15 seconds, on reconnection and after confirmed app transactions. Missing data is shown as unavailable; retained values are marked stale after a failed refresh or an old snapshot. The footer preserves six-decimal precision for TVL below $1. Deposit counts come from on-chain Deposit events, not replacement notes issued after repayment.</p>
          </Sec>

          <Sec id="signin" title="Sign-in and wallet">
            <p>You can use an embedded wallet or a supported external wallet. An external wallet connection is not always the same as an authenticated sign-in: complete the sign-in request when prompted. The selected wallet holds USDC and signs transfer authorizations for deposits and repayments. Withdrawals and loans pay out to the recipient address you enter.</p>
            <p>Your sign-in and your notes are separate things. Signing in does not give access to a note, and a note can be withdrawn by anyone who holds it, from any wallet. If you sign out, your notes are unaffected as long as you saved them.</p>
          </Sec>

          <Sec id="notes" title="Saving and recovering notes">
            <p>A note looks like <code>hushfund-usdc-100-ethereum-</code> followed by 256 hexadecimal characters. It encodes the denomination, network and the secrets behind your commitment.</p>
            <ul>
              <li><b>Copy it</b> to an offline place you control, such as a password manager.</li>
              <li><b>Encrypted backup:</b> the app can download <code>hushfund-recovery.json</code>, encrypted in your browser with AES-256-GCM and a key derived from your recovery password (PBKDF2-SHA-256, 250,000 iterations). The password must be at least 12 characters. It is never stored or sent anywhere.</li>
              <li><b>Recovery:</b> on My Notes you can paste a note or import a backup with its password. The app checks the backup belongs to Ethereum Mainnet and a supported denomination.</li>
            </ul>
            <div className="dc-callout warn">A forgotten recovery password cannot be reset. A backup without its password is useless.</div>
          </Sec>

          <Sec id="deposit" title="Deposit">
            <ol>
              <li>Choose a denomination and make sure your wallet holds that much native USDC.</li>
              <li>Your browser generates the note secrets and the commitment locally.</li>
              <li>Save the note (and optionally the encrypted backup) before continuing.</li>
              <li>You sign a USDC <code>receiveWithAuthorization</code> for exactly the denomination. Its nonce is bound to your commitment, so nobody can reuse the signature for a different deposit.</li>
              <li>The transaction is submitted (by the relayer when gas is sponsored). The vault supplies the funds to Aave and Morpho and inserts your commitment.</li>
            </ol>
            <p>The vault records a <b>bucketed yield index</b> with each deposit, so deposits in the same period share an index and look alike.</p>
          </Sec>

          <Sec id="proofs" title="Local zero-knowledge proofs">
            <p>Withdraw, borrow and repay require a proof generated in your browser with Barretenberg. The proof shows you know a note in the vault’s Merkle tree and binds the exact action details: recipient, relayer, relayer fee, borrow amount, chain and vault. Your note never leaves the browser.</p>
            <p>Proof generation is CPU-heavy and may take from several seconds to a minute or more on phones. Keep the tab open and in the foreground.</p>
          </Sec>

          <Sec id="withdraw" title="Withdraw and one-time spending">
            <p>Paste a note, enter a recipient and generate the proof. The contract checks the proof, marks the note’s nullifier as spent and transfers the payout.</p>
            <ul>
              <li>Payout = denomination × current yield index ÷ the note’s yield index, minus the protocol fee and any relayer fee.</li>
              <li><b>Each note can be spent exactly once.</b> A second attempt fails with “note already spent”.</li>
              <li>A note with an active loan cannot be withdrawn until the loan is repaid.</li>
              <li>Withdrawals cannot be paused by the owner, but they need enough liquidity in Aave or Morpho at that moment.</li>
            </ul>
          </Sec>

          <Sec id="borrow" title="Borrow">
            <p>You can borrow against a note without withdrawing it. The contract enforces a <b>maximum loan-to-value of 70%</b> of the note’s current value. The note stays in the vault as collateral and is locked while the loan is active.</p>
            <p>Debt grows at the vault’s own blended yield rate from the moment you borrow, so the debt tracks what the collateral earns. Borrowing can be paused for new loans. There is no liquidation mechanism in the contract; the collateral simply stays locked until repaid.</p>
          </Sec>

          <Sec id="repay" title="Repay with a fresh note">
            <p>Repaying requires the collateral note and a proof. You sign a USDC authorization slightly above the current debt (the app adds a small 0.1% buffer for blocks mined meanwhile); anything above the exact debt is refunded in the same transaction.</p>
            <ul>
              <li>The <b>old note is retired</b> permanently.</li>
              <li>A <b>fresh replacement note</b> with the same yield index is inserted. A later withdrawal uses a new note identifier, but timing, recipients and other public activity can still reveal a link to the loan.</li>
              <li>Save the replacement note before signing, exactly like a deposit note. The app offers an encrypted backup for it as well.</li>
            </ul>
            <div className="dc-callout warn">If you lose the replacement note after repaying, the old note cannot be used instead. The funds are tied to the new note only.</div>
          </Sec>

          <Sec id="yield" title="Yield strategies">
            <p>Each vault supplies USDC to <b>Aave V3</b> and to a <b>Morpho</b> ERC-4626 vault. Funds are split in the ratio of the two strategies’ indices, and the note’s value follows their average (blended) index.</p>
            <p>Yield is <b>variable and not guaranteed</b>. The APY shown in the app is derived from observed history and may say there is not enough history yet. Past rates do not predict future ones.</p>
            <p>The owner may propose moving funds to new strategy contracts. Any migration waits at least 2 days after it is proposed, giving you time to withdraw if you disagree.</p>
          </Sec>

          <Sec id="fees" title="Fees, rounding, gas and sponsorship">
            <ul>
              <li><b>Protocol fee</b> on withdrawal: set per vault in basis points by the owner and capped by the contract at 100 bps (1%). The preview is an estimate: the fee in effect when your transaction executes applies, and the owner can change it within that cap.</li>
              <li><b>Relayer fee</b> on withdraw and borrow: quoted at the time of the action and included in the proof. {config ? (config.sponsoredFees ? 'Currently this fee is sponsored (0).' : 'Currently relayer fees are charged.') : 'Whether it is sponsored depends on the server configuration.'}</li>
              <li><b>Gas:</b> {config ? (config.sponsoredGas ? 'deposits and repayments are currently submitted by the relayer, so you do not need ETH for them.' : 'gas sponsorship is currently not available; you need ETH for gas.') : 'sponsorship depends on the server configuration and can change.'} Sponsorship is an operational service, not a contract guarantee: it is limited by a per-wallet quota for new deposits and loans and by a shared daily budget. Repayments and withdrawals are exempt from the per-wallet quota but still need a valid authorization and remaining budget, and can fall back to requiring your own gas.</li>
              <li><b>Rounding:</b> deposits use the next yield-index bucket, so rounding can slightly reduce the payout from an immediate withdrawal. A bucket is not a fixed waiting period; its time-equivalent depends on yield. Debt uses upward integer rounding; USDC’s smallest unit is 0.000001 USDC.</li>
            </ul>
          </Sec>

          <Sec id="transactions" title="Confirmation and recovery after interruptions">
            <p>While a transaction is in progress the app blocks navigation. Wait for confirmation on Ethereum Mainnet before closing the tab.</p>
            <ul>
              <li>The app remembers the public transaction hash for a pending deposit or repay in this browser, so a reload can find out whether it confirmed. It never stores the note or password for this.</li>
              <li>If the tab closed mid-flow, import your note or encrypted backup on My Notes. The app checks on-chain whether the commitment exists or the note is spent.</li>
              <li>If a transaction was never submitted, the USDC stays in your wallet. A signed but unused authorization expires.</li>
            </ul>
          </Sec>

          <Sec id="storage" title="Browser-local storage risks">
            <p>By default, notes live only in memory for the current tab. You can opt in to keeping them in this browser’s local storage for convenience. Then anyone with access to this browser profile, an extension with page access, or malware could read them. Clearing site data deletes them.</p>
            <p>Browser storage is never a backup. Always keep your own copy.</p>
          </Sec>

          <Sec id="contracts" title="Public contract information">
            {isLoading && <div className="dc-skel" aria-busy="true"><i /><i /><i /></div>}
            {isError && (
              <p className="dc-callout warn">Contract information could not be loaded. <button className="dc-inline" onClick={() => refetch()}>Retry</button></p>
            )}
            {config && (
              <div className="dc-table" role="table" aria-label="Contract addresses">
                <div role="row"><span role="cell">Network</span><span role="cell">{config.network} (chain {config.chainId})</span></div>
                <div role="row"><span role="cell">USDC</span><a role="cell" href={`${explorer}/address/${config.usdc}`} target="_blank" rel="noreferrer">{config.usdc}</a></div>
                {config.vaults.map((v) => (
                  <div role="row" key={v.address}><span role="cell">{v.denominationUsdc} USDC vault</span><a role="cell" href={`${explorer}/address/${v.address}`} target="_blank" rel="noreferrer">{v.address}</a></div>
                ))}
                {config.relayer && <div role="row"><span role="cell">Relayer</span><a role="cell" href={`${explorer}/address/${config.relayer}`} target="_blank" rel="noreferrer">{config.relayer}</a></div>}
              </div>
            )}
            <p className="dc-small">Always verify addresses on a block explorer before interacting. Addresses come from the app configuration.</p>
          </Sec>

          <Sec id="privacy" title="Privacy limitations">
            <ul>
              <li>Deposits and withdrawals are public transactions. Privacy depends on how many other notes share your denomination and yield bucket.</li>
              <li>Withdrawing soon after depositing, to an address linked to you, or in an unusual pattern can make the link obvious.</li>
              <li>Loans, repayments and recipients are visible on-chain. Repay inserts a new note to reduce linkability, but it does not erase history.</li>
              <li>The API server, relayer, RPC provider and sign-in provider can see network metadata such as IP addresses and timing.</li>
              <li>Hushfund does not provide perfect anonymity, and you remain responsible for complying with the law.</li>
            </ul>
          </Sec>

          <Sec id="risks" title="Risks">
            <ul>
              <li><b>Smart contract risk:</b> bugs in the vault, verifier, circuits or dependencies could lead to loss.</li>
              <li><b>Strategy risk:</b> Aave or Morpho could suffer exploits, bad debt or temporary illiquidity that delays or reduces withdrawals.</li>
              <li><b>USDC risk:</b> the issuer can freeze addresses or the token could lose its peg.</li>
              <li><b>Operational risk:</b> the relayer, API or sign-in service can go down; sponsorship can end; the owner can pause deposits and loans, change fees within the cap, or migrate strategies after a delay.</li>
              <li><b>Key risk:</b> Hushfund cannot reset note secrets or backup passwords. Without another saved copy, losing them can mean losing access to funds. A compromised device can expose your notes.</li>
            </ul>
          </Sec>

          <Sec id="troubleshooting" title="Troubleshooting">
            <dl className="dc-dl">
              <dt>“Note already spent”</dt><dd>The note was withdrawn or retired by a repay. If you repaid, use the replacement note.</dd>
              <dt>“Above the 70% borrow limit”</dt><dd>Lower the amount. The limit is recalculated from the note’s current value.</dd>
              <dt>“Insufficient liquidity”</dt><dd>Aave or Morpho is temporarily fully utilised. Try again later.</dd>
              <dt>“Unknown root”</dt><dd>The tree changed while your proof was built. Generate the proof again.</dd>
              <dt>Proof is slow or the tab froze</dt><dd>Use a desktop browser, close heavy tabs and keep the page in the foreground.</dd>
              <dt>Cannot unlock a backup</dt><dd>Check the file and password. Backups only work for Ethereum Mainnet notes in 10, 50, 100 or 1000 USDC.</dd>
              <dt>Deposits or borrows are unavailable</dt><dd>The vault may be paused. Withdrawals and repayments still work.</dd>
            </dl>
          </Sec>

          <Sec id="faq" title="FAQ">
            <div className="dc-faq">
              {FAQ.map(([q, a]) => (
                <details key={q}><summary>{q}</summary><p>{a}</p></details>
              ))}
            </div>
          </Sec>
        </article>
      </div>
    </div>
  )
}

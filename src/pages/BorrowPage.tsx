import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { OpenfortButton } from '../components/SignInButton.tsx'
import { Head, Icon, useUi } from '../components/ui.tsx'
import { NoteField, NoteSummary, RecipientField, usdcStr } from './shared.tsx'
import { useActions } from '../hooks/useActions.ts'
import { useApy, useAppConfig, useUsdcBalance } from '../hooks/useVaultData.ts'
import { useNoteInfo } from '../hooks/useNoteInfo.ts'
import { useRecipient } from '../hooks/useEns.ts'
import { api } from '../lib/api.ts'

export function BorrowPage({ go, initialNote }: { go: (to: string) => void; initialNote?: string }) {
  const { data: config } = useAppConfig()
  const { address, isConnected } = useAccount()
  const { balance } = useUsdcBalance(config?.usdc, address)
  const { borrow, repay } = useActions(config)
  const { busy } = useUi()
  const [note, setNote] = useState(initialNote ?? '')
  const [to, setTo] = useState('')
  const [pct, setPct] = useState(70)
  const { info, loading, error, parseError } = useNoteInfo(note, config)
  const recipient = useRecipient(to)
  const apy = useApy(info?.parsed.vault.address)
  const viaRelayer = !!config?.relayer
  const quote = useQuery({ queryKey: ['quote', 'borrow'], queryFn: () => api.quote('borrow'), enabled: viaRelayer && !!info && !info.loanActive, refetchInterval: 30_000 })

  const amount = info ? (info.maxBorrow * BigInt(pct)) / 100n : 0n
  const fee = viaRelayer ? BigInt(quote.data?.fee ?? 0) : 0n
  const repayAmount = info ? info.debt + info.debt / 1000n + 1n : 0n

  return (
    <div className="pgrid">
      <section className="card" style={{ ['--i' as string]: 0 }}>
        <Head title={info?.loanActive ? 'Repay' : 'Borrow'} value={<p className="big num">{info ? usdcStr(info.loanActive ? info.debt : amount, 2) : '0.00 USDC'}</p>} />
        <NoteField id="br-note" value={note} onChange={setNote} />
        <NoteSummary info={info} loading={loading} error={parseError ?? error} />
        {info?.spent && <div className="err">This note has been withdrawn (or renewed after a repayment) and cannot be used as collateral.</div>}

        {info && !info.spent && info.loanActive && (
          <>
            <div className="loan num">
              <div className="row" style={{ marginBottom: 10 }}>
                <b style={{ color: 'var(--lime)', fontSize: 12.5, fontWeight: 600 }}>Active loan</b>
                <span className="small">grows at the vault yield rate</span>
              </div>
              <div className="line"><span className="k">Principal</span><span>{usdcStr(info.principal)}</span></div>
              <div className="line" style={{ marginTop: 6 }}><span className="k">Interest</span><span className="amber">+{usdcStr(info.debt - info.principal)}</span></div>
              <div className="line total" style={{ marginTop: 8 }}><span>To repay</span><span className="v">{usdcStr(info.debt)}</span></div>
            </div>
            <p className="small" style={{ margin: 0 }}>
              You sign for {usdcStr(repayAmount)} (debt plus 0.1% for blocks mined meanwhile); anything unused is refunded in the same transaction{config?.sponsoredGas ? ', and Hushfund pays the gas' : ''}. Repaying gives you a renewed note that cannot be linked to this loan.
            </p>
            {isConnected && balance !== undefined && balance < repayAmount && <div className="warnbox">Your balance is {usdcStr(balance, 2)}. Add USDC to this wallet to repay.</div>}
            {isConnected ? (
              <button className="primary" disabled={busy || balance === undefined || balance < repayAmount} onClick={() => repay(info.parsed)}>
                Repay {usdcStr(info.debt, 2)}
              </button>
            ) : (
              <OpenfortButton label="Sign in to repay" />
            )}
          </>
        )}

        {info && !info.spent && !info.loanActive && (
          <>
            <RecipientField id="br-to" value={to} onChange={setTo} me={address} />
            <div className="field">
              <div className="row">
                <label className="lbl2" htmlFor="br-pct">Borrow amount</label>
                <span className="small">Max {usdcStr(info.maxBorrow, 2)} (70% LTV)</span>
              </div>
              <input type="range" id="br-pct" min={1} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
              <div className="row"><b className="num" style={{ fontWeight: 500 }}>{usdcStr(amount, 2)}</b><span className="small">{pct}% of max</span></div>
            </div>
            <div className="box num">
              <div className="line"><span className="k">Interest rate (vault yield)</span><span className="amber">{apy.data?.blended != null ? `${apy.data.blended.toFixed(2)}%` : '—'}</span></div>
              {viaRelayer && <div className="line" style={{ marginTop: 6 }}><span className="k">Gas fee</span><span>{!quote.data ? '…' : fee === 0n ? 'Free' : `-${usdcStr(fee)}`}</span></div>}
              <div className="line total" style={{ marginTop: 8 }}><span>Recipient gets</span><span className="v">{usdcStr(amount > fee ? amount - fee : 0n)}</span></div>
            </div>
            {isConnected ? (
              <button className="primary" disabled={busy || !recipient.address || amount === 0n || amount <= fee || (viaRelayer && !quote.data)}
                onClick={() => recipient.address && borrow({ parsed: info.parsed, recipient: recipient.address, amount, useRelayer: viaRelayer })}>
                Borrow {usdcStr(amount, 2)}
              </button>
            ) : (
              <OpenfortButton label="Sign in to borrow" />
            )}
          </>
        )}
        {!info && !loading && !error && !parseError && (
          <p className="muted" style={{ fontSize: 12.5 }}>Paste a deposit note to borrow USDC against it, up to 70% of its value. The deposit stays in the vault and keeps earning.</p>
        )}
      </section>

      <section className="card" style={{ ['--i' as string]: 1 }}>
        <Head title="Loan terms" value={<p className="big num">70%<span className="unit"> max LTV</span></p>} to="notes" onGo={go} />
        <div>
          <div className="src"><span className="rb"><Icon name="pct" size={15} /></span><div className="lbl"><b>Interest</b><span>Equal to the vault yield, so your deposit earns what the loan costs.</span></div></div>
          <div className="src"><span className="rb"><Icon name="shield" size={15} /></span><div className="lbl"><b>No liquidation</b><span>Debt and collateral grow at the same rate, so the loan never goes underwater.</span></div></div>
          <div className="src"><span className="rb"><Icon name="lock" size={15} /></span><div className="lbl"><b>Locked collateral</b><span>The note cannot be withdrawn until the loan is repaid.</span></div></div>
          <div className="src"><span className="rb"><Icon name="eyeoff" size={15} /></span><div className="lbl"><b>Unlinkable exit</b><span>Repaying retires the note and gives you a fresh one, so the loan and the later withdrawal cannot be connected.</span></div></div>
        </div>
      </section>
    </div>
  )
}

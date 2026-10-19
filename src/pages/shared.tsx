import { useRef } from 'react'
import { ago, fmt } from '../lib/format.ts'
import type { NoteInfo } from '../hooks/useNoteInfo.ts'
import { useRecipient } from '../hooks/useEns.ts'
import { useNotes } from '../hooks/useNotes.tsx'

/** Note input with "paste my latest note" and .txt upload. */
export function NoteField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const { notes } = useNotes()
  const latest = [...notes].reverse().find((n) => n.status === 'active' || n.status === 'loan')
  const file = useRef<HTMLInputElement>(null)
  return (
    <div className="field">
      <label htmlFor={id}>Note</label>
      <input className="inp" id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="hushfund-usdc-1000-ethereum-…" autoComplete="off" spellCheck={false} />
      <div className="helprow">
        {latest && (
          <button className="linkbtn" onClick={() => onChange(latest.note)}>
            Use my latest note ({latest.denomination.toLocaleString()} USDC)
          </button>
        )}
        <label className="filelbl">
          Or upload a .txt file
          <input ref={file} type="file" accept=".txt" onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const r = new FileReader()
            r.onload = () => onChange(String(r.result).replace(/[^\x20-\x7E]/g, '').trim())
            r.readAsText(f)
          }} />
        </label>
      </div>
    </div>
  )
}

/** Recipient input: 0x address or ENS name, with a "Me" button. */
export function RecipientField({ id, value, onChange, me }: { id: string; value: string; onChange: (v: string) => void; me?: string }) {
  const r = useRecipient(value)
  return (
    <div className="field">
      <label htmlFor={id}>Recipient</label>
      <div className="inline">
        <input className="inp" id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="0x… or name.eth" autoComplete="off" spellCheck={false} />
        {me && <button className="mini" onClick={() => onChange(me)}>Me</button>}
      </div>
      {r.loading && <p className="small" style={{ margin: 0 }}>Looking up ENS name…</p>}
      {r.invalid && <p className="small" style={{ margin: 0, color: 'var(--down)' }}>Enter a 0x address (40 hex characters) or an ENS name.</p>}
      {r.notFound && <p className="small" style={{ margin: 0, color: 'var(--down)' }}>No address is linked to this ENS name.</p>}
      {r.ens && r.address && (
        <div className="ens">
          {r.avatar ? <img src={r.avatar} alt="" width={30} height={30} style={{ borderRadius: '50%' }} /> : <span className="me" />}
          <div>
            <b>{r.ens}</b>
            <span className="mono" style={{ color: 'var(--muted)' }}>{r.address.slice(0, 6)}…{r.address.slice(-4)}</span>
          </div>
        </div>
      )}
      {me && r.address && r.address.toLowerCase() === me.toLowerCase() && (
        <div className="warnbox">Sending to the wallet you signed in with links this withdrawal to you. Use a fresh address for privacy.</div>
      )}
    </div>
  )
}

/** The amount / deposited / deposits-after strip plus status messages for a note. */
export function NoteSummary({ info, loading, error }: { info?: NoteInfo; loading: boolean; error: string | null }) {
  if (error) return <div className="err">{error}</div>
  if (loading) return <div className="box small">Reading the note from the vault…</div>
  if (!info) return null
  return (
    <div className="box">
      <div className="tri">
        <div><p className="k">Amount</p><p className="v">{info.parsed.denomination.toLocaleString()} USDC</p></div>
        <div><p className="k">Deposited</p><p className="v">{info.depositedAt ? ago(info.depositedAt) : '—'}</p></div>
        <div><p className="k">Deposits after</p><p className="v num">{info.depositsAfter ?? '—'}</p></div>
      </div>
      {info.depositsAfter !== null && info.depositsAfter < 5 && !info.spent && (
        <p className="small" style={{ margin: '10px 0 0' }}>Only {info.depositsAfter} deposits came after yours. Waiting longer makes your withdrawal harder to trace.</p>
      )}
    </div>
  )
}

export const usdcStr = (units: bigint, d = 4) => `${fmt(Number(units) / 1e6, d)} USDC`

import { useEffect, useRef, useState } from 'react'
import './guide.css'

interface Step { kicker: string; title: string; body: string; points: string[]; safety?: string }

const STEPS: Step[] = [
  {
    kicker: 'Before you start',
    title: 'Hushfund in one minute',
    body: 'Hushfund is a fixed-denomination private USDC vault on Ethereum Mainnet. You deposit 10, 50, 100 or 1000 USDC and receive a private note. That note, not your account, is what proves ownership later.',
    points: ['Ethereum Mainnet and native USDC only', 'Custom amounts are not supported', 'Deposits earn variable yield from Aave and Morpho'],
  },
  {
    kicker: 'Step 1',
    title: 'Sign in and fund your wallet',
    body: 'Use the embedded wallet or a supported external wallet, and complete sign-in when the app asks. The selected wallet holds USDC and signs authorizations. Signing in alone does not recover a deposit: you still need its note.',
    points: ['Add native USDC on Ethereum Mainnet to that wallet', 'Check the balance pill in the header', 'Gas sponsorship depends on the current server configuration'],
  },
  {
    kicker: 'Step 2',
    title: 'Deposit and save your note',
    body: 'Pick a denomination. The browser creates the note secrets locally, then you sign a USDC authorization bound to that note. Save the note before you confirm anything.',
    points: ['Copy the note or download an encrypted backup', 'Use a recovery password of at least 12 characters', 'Do not leave the page during a pending transaction'],
    safety: 'Whoever holds the note can withdraw the funds. Hushfund cannot recover a lost note.',
  },
  {
    kicker: 'Step 3',
    title: 'Withdraw with a local proof',
    body: 'To withdraw, paste your note and a recipient. Your browser builds a zero-knowledge proof locally; the proof fixes recipient, relayer and fee, so a relayer cannot redirect funds.',
    points: ['Each note can be spent once', 'Payout reflects the yield index, minus any fees shown', 'Waiting longer and using a fresh recipient helps privacy'],
  },
  {
    kicker: 'Step 4',
    title: 'Borrow and repay',
    body: 'You can borrow up to 70% of a note’s current value without withdrawing it. Debt grows at the vault’s own yield rate. Repaying retires the old note and gives you a fresh replacement note.',
    points: ['A note with an active loan cannot be withdrawn', 'Save the replacement note just like a deposit note', 'Overpayment on repay is refunded in the same transaction'],
    safety: 'After repay, the old note is permanently retired. Only the new note can withdraw.',
  },
  {
    kicker: 'Finish',
    title: 'Keep these habits',
    body: 'Privacy and safety here come from careful habits, not guarantees. Smart contracts, Aave, Morpho and USDC all carry risk, and yield can change or drop.',
    points: ['Keep at least one offline backup of every note', 'Treat browser storage as convenient, not safe', 'Read the docs for fees, recovery and troubleshooting'],
  },
]

export function GuideModal({ open, onClose, onDocs }: { open: boolean; onClose: () => void; onDocs?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const previousOverflow = useRef('')
  const [i, setI] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      returnTo.current = document.activeElement as HTMLElement | null
      previousOverflow.current = document.documentElement.style.overflow
      setI(0)
      d.showModal()
      document.documentElement.style.overflow = 'hidden'
      requestAnimationFrame(() => d.querySelector<HTMLElement>('.gd-primary')?.focus())
    } else if (!open && d.open) {
      d.close()
    }
  }, [open])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const onClosed = () => {
      document.documentElement.style.overflow = previousOverflow.current
      returnTo.current?.focus?.()
      onCloseRef.current()
    }
    const onCancel = (e: Event) => { e.preventDefault(); d.close() }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const f = [...d.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]')]
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    d.addEventListener('close', onClosed)
    d.addEventListener('cancel', onCancel)
    d.addEventListener('keydown', onKey)
    return () => {
      d.removeEventListener('close', onClosed)
      d.removeEventListener('cancel', onCancel)
      d.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = previousOverflow.current
    }
  }, [])

  const s = STEPS[i]
  const last = i === STEPS.length - 1
  const move = (n: 1 | -1) => { setDir(n); setI((v) => Math.min(STEPS.length - 1, Math.max(0, v + n))) }
  const close = () => ref.current?.close()

  return (
    <dialog ref={ref} className="gd" aria-labelledby="gd-title" aria-describedby="gd-body"
      onClick={(e) => { if (e.target === ref.current) close() }}>
      <div className="gd-card">
        <div className="gd-top">
          <span className="gd-count num" aria-live="polite">Step {i + 1} of {STEPS.length}</span>
          <button className="gd-x" onClick={close} aria-label="Close guide">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="gd-prog" role="progressbar" aria-label="Guide progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={i + 1}>
          {STEPS.map((_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}
        </div>
        <div key={i} className={`gd-step ${dir > 0 ? 'fwd' : 'back'}`}>
          <p className="gd-kicker">{s.kicker.startsWith('Step ') ? `Step ${i + 1}` : s.kicker}</p>
          <h2 id="gd-title">{s.title}</h2>
          <p id="gd-body" className="gd-body">{s.body}</p>
          <ul className="gd-points">{s.points.map((p) => <li key={p}>{p}</li>)}</ul>
          {s.safety && <p className="gd-safety"><b>Safety</b> {s.safety}</p>}
        </div>
        <p className="gd-note">This guide only explains. It does not move funds, sign anything or change your sign-in.</p>
        <div className="gd-nav">
          <button className="gd-back" onClick={() => move(-1)} disabled={i === 0}>Back</button>
          {last && onDocs && <button className="gd-back" onClick={() => { close(); onDocs() }}>Open docs</button>}
          <button className="gd-primary" onClick={() => (last ? close() : move(1))}>{last ? 'Finish' : 'Next'}</button>
        </div>
      </div>
    </dialog>
  )
}

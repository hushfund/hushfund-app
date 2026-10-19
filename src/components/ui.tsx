import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { fmt } from '../lib/format.ts'
import { friendlyError } from '../lib/errors.ts'
import { useNotes } from '../hooks/useNotes.tsx'
import { RecoveryBackup } from './RecoveryBackup.tsx'
import type { RecoveryDraft } from '../lib/recovery.ts'

export const REDUCE_MOTION =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// ------------------------------------------------------------------ icons

const PATHS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  in: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  out: 'M12 21V9M7 14l5-5 5 5M4 3h16',
  coins: 'M3 7a6 3 0 1 0 12 0a6 3 0 1 0-12 0M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.7-2.7-3-6-3',
  note: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  clock: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7v5l3 2',
  arrow: 'M7 17L17 7M8 7h9v9',
  dollar:
    'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  eyeoff:
    'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.8 8.3 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1',
  lock: 'M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3',
  pct: 'M19 5L5 19M4.5 7a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M14.5 17a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
} as const
export type IconName = keyof typeof PATHS

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}

/** Hushfund mark (key + keyhole + smile), vector version of the brand logo in public/brand. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="100 110 1080 1080" fill="var(--lime)" color="var(--lime)" aria-hidden="true">
      <rect x="127" y="288" width="650" height="140" />
      <rect x="127" y="288" width="143" height="284" />
      <circle cx="944" cy="357" r="163" fill="none" stroke="currentColor" strokeWidth="136" />
      <path d="M127 712A503.6 503.6 0 0 0 1129 712L982 712A362 362 0 0 1 274 712Z" />
      <circle cx="628" cy="612" r="90" />
      <path d="M565 672H691L735 840H522Z" />
    </svg>
  )
}

// ------------------------------------------------------------------ building blocks

/** Card header: label, optional big value, a round icon and an optional lime arrow link. */
export function Head({ title, value, to, onGo, large }: { title: string; value?: ReactNode; to?: string; onGo?: (to: string) => void; large?: boolean }) {
  return (
    <div className="ch">
      <div>
        <p className={`ct${large ? ' lg' : ''}`}>{title}</p>
        {value}
      </div>
      <div className="cbtns">
        <span className="rb" aria-hidden="true">
          <Icon name="dollar" size={15} />
        </span>
        {to && onGo && (
          <button className="ab" onClick={() => onGo(to)} aria-label={`Open ${to}`}>
            <Icon name="arrow" />
          </button>
        )}
      </div>
    </div>
  )
}

/** Animates a number from 0 on mount; renders the final value immediately when motion is reduced. */
export function CountUp({ value, prefix = '', decimals = 2 }: { value: number; prefix?: string; decimals?: number }) {
  const [shown, setShown] = useState(REDUCE_MOTION ? value : 0)
  const from = useRef(0)
  useEffect(() => {
    if (REDUCE_MOTION) return setShown(value)
    const start = performance.now()
    const a = from.current
    let raf = 0
    const step = (t: number) => {
      const k = Math.min((t - start) / 1000, 1)
      const e = 1 - Math.pow(1 - k, 3)
      setShown(a + (value - a) * e)
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return (
    <>
      {prefix}
      {fmt(shown, decimals)}
    </>
  )
}

/** Cards below the fold start blurred and sharpen as they scroll into view. */
export function useRevealCards(dep: unknown) {
  useEffect(() => {
    if (REDUCE_MOTION || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          const el = e.target as HTMLElement
          el.classList.remove('pending')
          el.classList.add('reveal')
          io.unobserve(el)
          window.setTimeout(() => el.classList.remove('reveal'), 900)
        }),
      { rootMargin: '0px 0px -40px 0px' },
    )
    document.querySelectorAll<HTMLElement>('#view .card').forEach((c) => {
      if (c.getBoundingClientRect().top > window.innerHeight) {
        c.classList.add('pending')
        io.observe(c)
      }
    })
    return () => io.disconnect()
  }, [dep])
}

/** Glass header once scrolled, and a motion blur on the content proportional to scroll speed. */
export function useScrollEffects(fxRef: React.RefObject<HTMLDivElement | null>, topRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    let lastY = window.scrollY
    let vel = 0
    let raf = 0
    const tick = () => {
      vel *= 0.82
      const b = Math.min(vel / 22, 3.2)
      if (fxRef.current) fxRef.current.style.filter = b > 0.12 ? `blur(${b.toFixed(2)}px)` : ''
      if (vel > 0.25) raf = requestAnimationFrame(tick)
      else {
        raf = 0
        if (fxRef.current) fxRef.current.style.filter = ''
      }
    }
    const onScroll = () => {
      topRef.current?.classList.toggle('scrolled', window.scrollY > 6)
      if (REDUCE_MOTION) return
      const y = window.scrollY
      vel = Math.min(vel + Math.abs(y - lastY), 90)
      lastY = y
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const onMove = (e: PointerEvent) => {
      const c = (e.target as HTMLElement | null)?.closest?.('.card') as HTMLElement | null
      if (!c) return
      const r = c.getBoundingClientRect()
      c.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [fxRef, topRef])
}

// ------------------------------------------------------------------ modals, flows and toasts

export interface FlowController {
  step: (index: number) => void
  done: (content: ReactNode) => void
  fail: (err: unknown) => void
}

interface FlowState {
  title: string
  steps: string[]
  current: number
  error: string | null
  content: ReactNode | null
}

interface UiCtx {
  requireBackup: (draft: RecoveryDraft) => Promise<void>
  toast: (msg: string) => void
  startFlow: (title: string, steps: string[]) => FlowController
  openModal: (content: ReactNode) => void
  closeModal: () => void
  busy: boolean
}

const Ctx = createContext<UiCtx | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [backup, setBackup] = useState<{ draft: RecoveryDraft; resolve: () => void; reject: () => void } | null>(null)
  const [flow, setFlow] = useState<FlowState | null>(null)
  const [modal, setModal] = useState<ReactNode | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<number>(0)

  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 3600)
  }, [])

  const startFlow = useCallback((title: string, steps: string[]): FlowController => {
    setFlow({ title, steps, current: 0, error: null, content: null })
    return {
      step: (i) => setFlow((f) => (f ? { ...f, current: i } : f)),
      done: (content) => setFlow((f) => (f ? { ...f, current: f.steps.length, content } : f)),
      fail: (err) => {
        console.error('Hushfund operation failed; details are shown privately in the flow.')
        setFlow((f) => (f ? { ...f, error: friendlyError(err) } : f))
      },
    }
  }, [])

  const value = useMemo(
    () => ({
      toast,
      requireBackup: (draft: RecoveryDraft) => new Promise<void>((resolve, reject) => setBackup({
        draft, resolve, reject: () => reject(new Error('Transaction cancelled. No transaction was sent.')),
      })),
      startFlow,
      openModal: (c: ReactNode) => setModal(c),
      closeModal: () => {
        setModal(null)
        setFlow(null)
      },
      busy: backup !== null || (flow !== null && flow.content === null && flow.error === null),
    }),
    [toast, startFlow, flow, backup],
  )

  const close = () => {
    setFlow(null)
    setModal(null)
  }
  let body: ReactNode = null
  if (backup) {
    body = <RecoveryBackup draft={backup.draft} onContinue={() => { setBackup(null); backup.resolve() }} onCancel={() => { setBackup(null); backup.reject() }} />
  } else if (flow) {
    body = flow.content ?? (
      <>
        <h3>{flow.title}</h3>
        <ol className="steps">
          {flow.steps.map((s, i) => (
            <li key={s} className={i < flow.current ? 'done' : i === flow.current && !flow.error ? 'active' : ''}>
              <span className="ic" />
              <span>{s}</span>
            </li>
          ))}
        </ol>
        {flow.error ? (
          <>
            <div className="err" role="alert">{flow.error}</div>
            <button className="primary" onClick={close}>Close</button>
          </>
        ) : (
          <p className="hint">Keep this tab open. Proofs are generated on your device and can take up to a minute.</p>
        )}
      </>
    )
  } else if (modal) body = modal

  return (
    <Ctx.Provider value={value}>
      {children}
      {body &&
        createPortal(
          <div id="modal">
            <div className="backdrop" onClick={() => (value.busy ? undefined : close())} />
            <div className="modal" role="dialog" aria-modal="true">
              {body}
            </div>
          </div>,
          document.body,
        )}
      {toastMsg && createPortal(<div id="toast" role="status">{toastMsg}</div>, document.body)}
    </Ctx.Provider>
  )
}

export function useUi() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUi must be used inside UiProvider')
  return v
}

/** Shown after a deposit or a repayment: the note must be saved before closing. */
export function NoteModal({ title, note, intro, onUse }: { title: string; note: string; intro: string; onUse?: () => void }) {
  const { closeModal } = useUi()
  const { persist, setPersist } = useNotes()
  const [copied, setCopied] = useState(false)
  const [ok, setOk] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(note)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      const r = document.createRange()
      if (box.current) r.selectNodeContents(box.current)
      const s = window.getSelection()
      s?.removeAllRanges()
      s?.addRange(r)
    }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([note], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `hushfund-note-${note.split('-').slice(4).join('').slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <h3>{title}</h3>
      <p className="muted">{intro}</p>
      <div className="notebox" ref={box}>{note}</div>
      <div className="two">
        <button className="mini" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        <button className="mini" onClick={download}>Download .txt</button>
      </div>
      <div className="savewarn">
        Save this note. It is the only way to withdraw your funds. If you lose it, the deposit cannot be recovered.
      </div>
      <label className="check">
        <input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} />
        Also remember my notes in this browser
      </label>
      <label className="check">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I have backed up this note
      </label>
      <div className="two">
        {onUse && (
          <button className="mini" disabled={!ok} onClick={() => { closeModal(); onUse() }}>
            Open My Notes
          </button>
        )}
        <button className="primary" disabled={!ok} onClick={closeModal}>
          Done
        </button>
      </div>
    </>
  )
}

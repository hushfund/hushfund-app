import { useCallback, useEffect, useRef, useState } from 'react'
import { OpenfortButton } from './components/SignInButton.tsx'
import { useAccount } from 'wagmi'
import { Icon, Logo, REDUCE_MOTION, useRevealCards, useScrollEffects, useUi, type IconName } from './components/ui.tsx'
import { useAppConfig, useUsdcBalance } from './hooks/useVaultData.ts'
import { IS_AUTH_CONFIGURED } from './lib/env.ts'
import { fmt } from './lib/format.ts'
import { Dashboard } from './pages/Dashboard.tsx'
import { DepositPage } from './pages/DepositPage.tsx'
import { WithdrawPage } from './pages/WithdrawPage.tsx'
import { BorrowPage } from './pages/BorrowPage.tsx'
import { NotesPage } from './pages/NotesPage.tsx'
import { ActivityPage } from './pages/ActivityPage.tsx'
import { Footer } from './components/Footer.tsx'
import { GuideModal } from './components/GuideModal.tsx'
import { DocsPage } from './pages/DocsPage.tsx'
import { syncDocumentSeo } from './lib/documentSeo.ts'
import { fromPath, toPath, type Page, type View } from './lib/appRoutes.ts'

export type { Page } from './lib/appRoutes.ts'
const PAGES: [Page, string, IconName][] = [
  ['dashboard', 'Dashboard', 'home'],
  ['deposit', 'Deposit', 'in'],
  ['withdraw', 'Withdraw', 'out'],
  ['borrow', 'Borrow', 'coins'],
  ['notes', 'My Notes', 'note'],
  ['activity', 'Activity', 'list'],
]

/** Hand-off between pages: e.g. "Withdraw" on a note opens the withdraw page with that note filled in. */
export interface Handoff {
  note?: string
}

export default function App() {
  const [page, setPage] = useState<View>(() => fromPath(window.location.pathname))
  useEffect(() => { syncDocumentSeo(window.location.pathname) }, [page])
  const [handoff, setHandoff] = useState<Handoff>({})
  const [entering, setEntering] = useState(true)
  const viewRef = useRef<HTMLElement>(null)
  const fxRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLElement>(null)
  const { busy } = useUi()
  const [guideOpen, setGuideOpen] = useState(() => new URLSearchParams(window.location.search).get('guide') === '1')
  const isApp = page !== 'docs'

  useScrollEffects(fxRef, topRef)
  useRevealCards(page)

  useEffect(() => {
    const onPop = () => setPage(fromPath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (!entering) return
    const t = window.setTimeout(() => setEntering(false), 1600)
    return () => window.clearTimeout(t)
  }, [entering, page])

  /** Blur the current page out, swap, then blur the next page in. */
  const go = useCallback(
    async (target: View, h: Handoff = {}) => {
      if (busy) return
      setHandoff(h)
      if (target === page) return
      if (!REDUCE_MOTION) {
        viewRef.current?.classList.add('leave')
        await new Promise((r) => setTimeout(r, 240))
      }
      window.history.pushState(null, '', toPath(target))
      window.scrollTo(0, 0)
      setPage(target)
      setEntering(true)
      requestAnimationFrame(() => viewRef.current?.classList.remove('leave'))
    },
    [page, busy],
  )
  const goPage = useCallback((to: string) => go(to as Page), [go])

  return (
    <>
      <header className="top" ref={topRef}>
        <div className="wrap topin">
          <button className="brand" style={{ background: 'none', border: 0, padding: 0, color: 'inherit' }} onClick={() => go('dashboard')}>
            <Logo /> Hushfund
          </button>
          {isApp && (
            <nav className="nav" aria-label="Pages">
              {PAGES.map(([k, label, icon]) => (
                <button key={k} className={`np${page === k ? ' on' : ''}`} aria-current={page === k ? 'page' : undefined} onClick={() => go(k)}>
                  <Icon name={icon} size={15} />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          )}
          <HeaderActions onLaunch={() => go('dashboard')} isDocs={!isApp} />
        </div>
      </header>

      <div id="fx" ref={fxRef}>
        <main className={`wrap${entering && !REDUCE_MOTION ? ' enter' : ''}`} id="view" ref={viewRef}>
          {isApp && <h1 className="hf-page-heading">{PAGES.find(([key]) => key === page)?.[1]} · Hushfund</h1>}
          {isApp && !IS_AUTH_CONFIGURED && (
            <p className="warnbox" role="status">
              Sign-in is not configured. You can browse the frontend, but login and transactions are unavailable.
            </p>
          )}
          {page === 'dashboard' && <Dashboard go={goPage} />}
          {page === 'deposit' && <DepositPage go={goPage} />}
          {page === 'withdraw' && <WithdrawPage go={goPage} initialNote={handoff.note} />}
          {page === 'borrow' && <BorrowPage go={goPage} initialNote={handoff.note} />}
          {page === 'notes' && <NotesPage go={(to, note) => go(to as Page, { note })} />}
          {page === 'docs' && <DocsPage onGuide={() => setGuideOpen(true)} onLaunch={() => go('dashboard')} />}
          {page === 'activity' && <ActivityPage go={goPage} />}
        </main>
      </div>
      {/* outside #fx: the scroll blur uses a CSS filter, which would break position:fixed and blur the bar */}
      <Footer onDocs={() => go('docs')} onGuide={() => setGuideOpen(true)} />
      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} onDocs={() => go('docs')} />
    </>
  )
}

function HeaderActions({ onLaunch, isDocs }: { onLaunch: () => void; isDocs: boolean }) {
  const { address, isConnected } = useAccount()
  const { data: config } = useAppConfig()
  const { balance } = useUsdcBalance(config?.usdc, address)

  if (isDocs) {
    return (
      <div className="acts">
        <button className="signin" onClick={onLaunch}>Launch app</button>
      </div>
    )
  }
  return (
    <div className="acts">
      <span className="netpill">
        <i />
        Ethereum Mainnet
      </span>
      {isConnected && balance !== undefined && <span className="balpill num">{fmt(Number(balance) / 1e6)} USDC</span>}
      <OpenfortButton label={isConnected ? undefined : 'Sign in'} />
    </div>
  )
}

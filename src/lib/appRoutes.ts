export type Page = 'dashboard' | 'deposit' | 'withdraw' | 'borrow' | 'notes' | 'activity'
export type View = Page | 'docs'

const pages: readonly string[] = ['dashboard', 'deposit', 'withdraw', 'borrow', 'notes', 'activity']

/** The application domain opens the dashboard; marketing lives on ENS. */
export function fromPath(path: string): View {
  const clean = path.replace(/\/+$/, '') || '/'
  if (clean === '/docs') return 'docs'
  const parts = clean.split('/')
  return parts[1] === 'app' && pages.includes(parts[2]) ? parts[2] as Page : 'dashboard'
}

export function toPath(page: View): string {
  return page === 'docs' ? '/docs' : page === 'dashboard' ? '/app' : `/app/${page}`
}

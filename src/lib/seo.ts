/** Production origin verified with the publishing service, not a Preview URL. */
export const SITE_ORIGIN = 'https://hushfund.app'
export const SOCIAL_IMAGE = `${SITE_ORIGIN}/brand/hushfund-og.png`

export const ROUTE_SEO: Record<string, { title: string; description: string; index: boolean }> = {
  '/': {
    title: 'Hushfund App | USDC Vaults on Ethereum Mainnet',
    description: 'Open the Hushfund application dashboard on Ethereum Mainnet. Deposit USDC, manage private notes, withdraw, borrow and repay against your vault deposits.',
    index: true,
  },
  '/docs': {
    title: 'Hushfund Docs | USDC Deposits, Privacy and Borrowing',
    description: 'Understand Hushfund on Ethereum Mainnet: USDC notes, deposits, withdrawals, borrowing, repayment, Aave and Morpho yield, recovery, fees and privacy limits.',
    index: true,
  },
  '/app': { title: 'Vault Dashboard | Hushfund', description: 'View Hushfund vault balances, USDC asset allocation, variable yield and on-chain activity on Ethereum Mainnet.', index: false },
  '/app/deposit': { title: 'Deposit USDC | Hushfund', description: 'Deposit 10, 50, 100 or 1,000 USDC into Hushfund on Ethereum Mainnet. Save your private note and an encrypted recovery backup.', index: false },
  '/app/withdraw': { title: 'Withdraw USDC | Hushfund', description: 'Use your Hushfund note to generate a proof in your browser and request a USDC withdrawal on Ethereum Mainnet.', index: false },
  '/app/borrow': { title: 'Borrow and Repay USDC | Hushfund', description: 'Borrow USDC against a Hushfund note or repay an active loan on Ethereum Mainnet. Review debt, costs and replacement-note recovery.', index: false },
  '/app/notes': { title: 'My Private Notes | Hushfund', description: 'Manage your Hushfund notes locally in your browser. Import notes, save encrypted recovery backups and review withdrawal or loan options.', index: false },
  '/app/activity': { title: 'Ethereum Mainnet Activity | Hushfund', description: 'Explore public Hushfund vault activity recorded on Ethereum Mainnet. Private note secrets are never included in public activity.', index: false },
}

export function pageSeo(pathname: string) {
  const path = `/${pathname.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '')}`
  return {
    path,
    canonical: `${SITE_ORIGIN}${path}`,
    ...(ROUTE_SEO[path] ?? { title: 'Page Not Found | Hushfund', description: 'This Hushfund page could not be found. Return to the homepage or read the documentation.', index: false }),
  }
}

const escaped = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function structuredData(path: string) {
  const page = pageSeo(path)
  const graph: object[] = [
    { '@type': 'Organization', '@id': `${SITE_ORIGIN}/#organization`, name: 'Hushfund', url: `${SITE_ORIGIN}/`, logo: `${SITE_ORIGIN}/brand/hushfund-icon-512.png`, sameAs: ['https://x.com/Hushfund_'] },
    { '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, name: 'Hushfund', url: `${SITE_ORIGIN}/`, publisher: { '@id': `${SITE_ORIGIN}/#organization` }, inLanguage: 'en' },
    { '@type': 'WebApplication', '@id': `${SITE_ORIGIN}/#app`, name: 'Hushfund', url: `${SITE_ORIGIN}/app`, applicationCategory: 'FinanceApplication', operatingSystem: 'Web', description: ROUTE_SEO['/'].description, image: SOCIAL_IMAGE },
    { '@type': 'WebPage', '@id': page.canonical, url: page.canonical, name: page.title, description: page.description, isPartOf: { '@id': `${SITE_ORIGIN}/#website` }, inLanguage: 'en' },
  ]
  if (page.path === '/docs') graph.push({
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Hushfund', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Docs', item: `${SITE_ORIGIN}/docs` },
    ],
  })
  return { '@context': 'https://schema.org', '@graph': graph }
}

export function seoMarkup(path: string): string {
  const page = pageSeo(path)
  const meta = (kind: 'name' | 'property', key: string, value: string) => `<meta ${kind}="${key}" content="${escaped(value)}" />`
  return [
    `<title>${escaped(page.title)}</title>`,
    meta('name', 'description', page.description),
    meta('name', 'robots', page.index ? 'index, follow, max-image-preview:large' : 'noindex, follow'),
    `<link rel="canonical" href="${escaped(page.canonical)}" />`,
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', 'Hushfund'),
    meta('property', 'og:locale', 'en_US'),
    meta('property', 'og:title', page.title),
    meta('property', 'og:description', page.description),
    meta('property', 'og:url', page.canonical),
    meta('property', 'og:image', SOCIAL_IMAGE),
    meta('property', 'og:image:secure_url', SOCIAL_IMAGE),
    meta('property', 'og:image:type', 'image/png'),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('property', 'og:image:alt', 'Hushfund — Your money, hushed. Private USDC vaults on Ethereum Mainnet.'),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:site', '@Hushfund_'),
    meta('name', 'twitter:creator', '@Hushfund_'),
    meta('name', 'twitter:title', page.title),
    meta('name', 'twitter:description', page.description),
    meta('name', 'twitter:image', SOCIAL_IMAGE),
    meta('name', 'twitter:image:alt', 'Hushfund — private USDC vaults on Ethereum Mainnet.'),
    `<script id="hushfund-structured-data" type="application/ld+json">${JSON.stringify(structuredData(path)).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ')
}

export function renderSeoHtml(html: string, path: string): string {
  if (!html.includes('<!-- hushfund:seo:start -->')) throw new Error('Missing Hushfund SEO template boundary')
  return html.replace(/<!-- hushfund:seo:start -->[\s\S]*?<!-- hushfund:seo:end -->/, `<!-- hushfund:seo:start -->\n    ${seoMarkup(path)}\n    <!-- hushfund:seo:end -->`)
}

export function sitemapXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.entries(ROUTE_SEO).filter(([, seo]) => seo.index).map(([path]) => `<url><loc>${SITE_ORIGIN}${path}</loc></url>`).join('')}</urlset>`
}

export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`
}


import assert from 'node:assert/strict'
import test from 'node:test'
import { ROUTE_SEO, pageSeo, renderSeoHtml, robotsTxt, sitemapXml, structuredData } from '../src/lib/seo.ts'

test('every real route has unique Hushfund metadata and the verified canonical origin', () => {
  const titles = new Set<string>()
  for (const path of Object.keys(ROUTE_SEO)) {
    const page = pageSeo(path)
    assert.match(page.title, /Hushfund/)
    assert.ok(!titles.has(page.title))
    titles.add(page.title)
    assert.equal(page.canonical, `https://hushfund.app${path}`)
    assert.ok(page.description.length > 80)
  }
})

test('bots receive original brand social metadata before JavaScript runs', () => {
  const html = renderSeoHtml('<head><!-- hushfund:seo:start --><title>old</title><!-- hushfund:seo:end --></head>', '/docs')
  assert.match(html, /Hushfund Docs/)
  assert.match(html, /summary_large_image/)
  assert.match(html, /https:\/\/hushfund.app\/brand\/hushfund-og.png/)
  assert.match(html, /og:image:width" content="1200"/)
  assert.match(html, /application\/ld\+json/)
  assert.equal((html.match(/<title>/g) ?? []).length, 1)
})

test('only public informational pages enter the sitemap', () => {
  assert.match(sitemapXml(), /https:\/\/hushfund.app\/docs/)
  assert.doesNotMatch(sitemapXml(), /\/app|\.internal|testnet/)
  assert.match(robotsTxt(), /Disallow: \/api\//)
  assert.equal(pageSeo('/app/notes').index, false)
  assert.equal(pageSeo('/missing').index, false)
})

test('canonical URLs omit tracking and note query parameters', () => {
  assert.equal(pageSeo('/docs/?source=social#notes').canonical, 'https://hushfund.app/docs')
  assert.equal(pageSeo('/app/notes?note=private').canonical, 'https://hushfund.app/app/notes')
  assert.doesNotMatch(JSON.stringify(structuredData('/docs')), /aggregateRating|reviewCount|audited/i)
})

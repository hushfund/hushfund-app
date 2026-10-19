import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { ROUTE_SEO, renderSeoHtml, robotsTxt, sitemapXml } from './src/lib/seo.ts'

const hushfundSeo = (): Plugin => ({
  name: 'hushfund-original-brand-seo',
  enforce: 'post',
  transformIndexHtml(html, ctx) {
    return renderSeoHtml(html, ctx.originalUrl ?? ctx.path)
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = ((req as { url?: string }).url ?? '').split('?')[0]
      if (pathname !== '/robots.txt' && pathname !== '/sitemap.xml') return next()
      res.setHeader('Content-Type', pathname.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8')
      res.end(pathname.endsWith('.xml') ? sitemapXml() : robotsTxt())
    })
  },
  generateBundle(_options, bundle) {
    const entry = bundle['index.html']
    if (!entry || entry.type !== 'asset') throw new Error('Hushfund HTML entry is unavailable')
    const template = String(entry.source)
    entry.source = renderSeoHtml(template, '/')
    for (const path of Object.keys(ROUTE_SEO).filter(path => path !== '/')) {
      this.emitFile({ type: 'asset', fileName: `${path.slice(1)}/index.html`, source: renderSeoHtml(template, path) })
    }
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt() })
    this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml() })
  },
})

export default defineConfig({
  plugins: [react(), hushfundSeo()],
  appType: 'spa',
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  define: {
    'global': 'globalThis',
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      buffer: 'buffer/',
    },
  },
  optimizeDeps: {
    force: true,
    exclude: ['@aztec/bb.js', '@noir-lang/noir_js', '@noir-lang/acvm_js', '@noir-lang/noirc_abi'],
    esbuildOptions: {
      inject: ['./buffer-shim.js'],
    },
  },
})

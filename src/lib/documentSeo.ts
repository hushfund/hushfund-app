import { pageSeo, structuredData } from './seo.ts'

/** Browser-only counterpart to the build-time SEO renderer. */
export function syncDocumentSeo(path: string) {
  const page = pageSeo(path)
  document.title = page.title
  const values = [
    ['name', 'description', page.description],
    ['name', 'robots', page.index ? 'index, follow, max-image-preview:large' : 'noindex, follow'],
    ['property', 'og:title', page.title], ['property', 'og:description', page.description],
    ['property', 'og:url', page.canonical], ['name', 'twitter:title', page.title],
    ['name', 'twitter:description', page.description],
  ]
  values.forEach(([attribute, key, content]) => {
    const meta = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`) ?? document.createElement('meta')
    meta.setAttribute(attribute, key)
    meta.content = content
    if (!meta.parentElement) document.head.append(meta)
  })
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ?? document.createElement('link')
  canonical.rel = 'canonical'
  canonical.href = page.canonical
  if (!canonical.parentElement) document.head.append(canonical)
  const schema = document.getElementById('hushfund-structured-data')
  if (schema) schema.textContent = JSON.stringify(structuredData(path))
}

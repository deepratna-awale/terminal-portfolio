import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { parseAboutMarkdown, siteProfile } from './shared/about.js'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
const aboutFile = new URL('./ABOUT.md', import.meta.url)

// Fills index.html from ABOUT.md and generates the files that depend on it:
// the favicon with the owner's initials, robots.txt and sitemap.xml.
function aboutSite(): Plugin {
  const load = () => {
    const about = parseAboutMarkdown(readFileSync(aboutFile, 'utf8'))
    const profile = siteProfile(about.meta)
    const seo = (about.meta.seo ?? {}) as Record<string, string>
    const tokens: Record<string, string> = {
      name: profile.name,
      website: profile.website,
      description: seo.description ?? `${profile.name}, ${profile.title}`,
      share_description: seo.share_description ?? seo.description ?? profile.title,
    }
    const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="2" y="2" width="60" height="60" rx="10" fill="#050a06" stroke="#39ff88" stroke-width="4"/>
  <text x="32" y="42" text-anchor="middle" font-family="'JetBrains Mono',Menlo,Consolas,monospace" font-size="26" font-weight="700" fill="#39ff88">&gt;${escapeHtml(profile.initials)}</text>
</svg>
`
    const robots = `User-agent: *\nAllow: /\n\nSitemap: ${profile.website}/sitemap.xml\n`
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${profile.website}/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${profile.website}/gui</loc>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
`
    return { tokens, files: { 'favicon.svg': favicon, 'robots.txt': robots, 'sitemap.xml': sitemap } as Record<string, string> }
  }
  const types: Record<string, string> = { svg: 'image/svg+xml', txt: 'text/plain', xml: 'application/xml' }
  return {
    name: 'about-site',
    transformIndexHtml: (html) => {
      const { tokens } = load()
      return html.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in tokens ? escapeHtml(tokens[key]!) : match))
    },
    configureServer(server) {
      server.watcher.add(aboutFile.pathname)
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0]!.slice(1)
        const file = load().files[path]
        if (!file) return next()
        response.setHeader('Content-Type', types[path.split('.').pop()!] ?? 'text/plain')
        response.end(file)
      })
    },
    generateBundle() {
      if (this.environment.config.consumer === 'server') return
      for (const [fileName, source] of Object.entries(load().files)) this.emitFile({ type: 'asset', fileName, source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), aboutSite()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})

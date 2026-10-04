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
    // Initials in terminal green on a dark tile with a blinking block cursor.
    // "DA" is drawn as paths so it stays crisp at 16px; other initials use text.
    const letters = profile.initials === 'DA'
      ? `<path fill="#39ff14" fill-rule="evenodd" d="M3.5 9h4a5 5 0 0 1 5 5v4a5 5 0 0 1-5 5h-4zM6.5 12v8h1a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z"/>
  <path fill="#39ff14" fill-rule="evenodd" d="M13.5 23l3.1-14h2.8l3.1 14h-3l-.6-3h-2.6l-.6 3zM17 17.3h2l-1-5z"/>`
      : `<text x="13" y="22.5" text-anchor="middle" font-family="Inter,Arial,Helvetica,sans-serif" font-size="14" font-weight="800" fill="#39ff14">${escapeHtml(profile.initials.slice(0, 2))}</text>`
    const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#0d1117"/>
  ${letters}
  <rect x="24.5" y="9" width="4" height="14" fill="#39ff14">
    <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1.1s" repeatCount="indefinite"/>
  </rect>
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

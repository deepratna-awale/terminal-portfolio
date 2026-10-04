// Writes dist/gui.html: the built index.html shell with the static portfolio rendered inside #root.
import { readFile, writeFile } from 'node:fs/promises'
import { parseAboutMarkdown, siteProfile } from '../shared/about.js'

const about = parseAboutMarkdown(await readFile(new URL('../ABOUT.md', import.meta.url), 'utf8'))
const profile = siteProfile(about.meta)
const escapeAttr = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const site = profile.website
const title = escapeAttr(`${profile.name} | Portfolio`)
const description = escapeAttr(about.meta.seo?.gui_description ?? about.meta.seo?.description ?? `${profile.name}, ${profile.title}`)
const placeholder = '<!--projects-->'
const noscript = `<noscript><p style="font-family:system-ui,sans-serif;color:#e8eaf0;padding:2rem">This terminal needs JavaScript. Read the <a style="color:#3ddc97" href="/gui">full portfolio as a standard web page</a> instead.</p></noscript>`

const dist = new URL('../dist/', import.meta.url)
const { render } = await import(new URL('../dist-ssr/entry-server.js', import.meta.url).href)

function swap(html, pattern, value, label) {
  if (!pattern.test(html)) throw new Error(`prerender: could not find ${label} in dist/index.html`)
  return html.replace(pattern, value)
}

const markup = render()
if (!markup.includes(placeholder)) throw new Error(`prerender: rendered portfolio is missing the ${placeholder} placeholder`)

const index = swap(await readFile(new URL('index.html', dist), 'utf8'), /<noscript>[\s\S]*?<\/noscript>/, noscript, '<noscript>')
await writeFile(new URL('index.html', dist), index)

let gui = index
gui = swap(gui, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, '<title>')
gui = swap(gui, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${description}" />`, 'meta description')
gui = swap(gui, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${site}/gui" />`, 'canonical link')
gui = swap(gui, /<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${site}/gui" />`, 'og:url')
gui = swap(gui, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${title}" />`, 'og:title')
gui = swap(gui, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${description}" />`, 'og:description')
gui = swap(gui, /<meta name="theme-color" content="[^"]*"\s*\/?>/, '<meta name="theme-color" content="#0a0c10" />', 'theme-color')
// Without JS the menu and theme buttons do nothing, so hide them.
gui = swap(gui, /<noscript>[\s\S]*?<\/noscript>/, '<noscript><style>.pf-menu-btn,.pf-icon-btn{display:none!important}</style></noscript>', '<noscript>')
gui = swap(gui, /<div id="root"><\/div>/, () => `<div id="root">${markup}</div>`, '#root')

await writeFile(new URL('gui.html', dist), gui)
console.log(`prerender: wrote dist/gui.html (${(gui.length / 1024).toFixed(1)} kB)`)

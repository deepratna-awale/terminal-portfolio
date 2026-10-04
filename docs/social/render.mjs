// Renders og.html to public/og.png (link previews) and docs/social/repo-preview.png
// (GitHub social preview). Needs Playwright: npx -y -p playwright node docs/social/render.mjs
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const page = new URL('./og.html', import.meta.url).href
const shots = [
  { hash: '', width: 1200, height: 630, out: '../../public/og.png' },
  { hash: '#repo', width: 1280, height: 640, out: './repo-preview.png' },
]
const browser = await chromium.launch()
for (const { hash, width, height, out } of shots) {
  const tab = await browser.newPage({ viewport: { width, height } })
  await tab.goto(page + hash)
  await tab.evaluate(() => document.fonts.ready)
  await tab.screenshot({ path: fileURLToPath(new URL(out, import.meta.url)) })
  await tab.close()
}
await browser.close()

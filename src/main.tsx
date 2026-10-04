import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Portfolio } from './gui/Portfolio.tsx'
import { profile } from './content.ts'
import { startsInGui } from './modeStore.ts'

const gui = startsInGui(location)
// Phones land on the site; keep the address honest so reloads and shares match.
if (gui && location.pathname === '/') history.replaceState(null, '', `/gui${location.hash}`)
if (gui) document.title = `${profile.name} | Portfolio`

// /gui is prerendered for crawlers and no-JS visitors; the client renders fresh instead of hydrating.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {gui ? <Portfolio /> : <App />}
  </StrictMode>,
)

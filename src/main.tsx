import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Portfolio } from './gui/Portfolio.tsx'

const gui = /^\/gui(\/|\.html|$)/.test(location.pathname)
if (gui) document.title = 'Deepratna Awale | Portfolio'

// /gui is prerendered for crawlers and no-JS visitors; the client renders fresh instead of hydrating.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {gui ? <Portfolio /> : <App />}
  </StrictMode>,
)

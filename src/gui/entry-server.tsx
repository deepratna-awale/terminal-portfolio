import { renderToString } from 'react-dom/server'
import { Portfolio } from './Portfolio'

// Static markup for /gui. Projects are injected by the server at the <!--projects--> placeholder.
export function render(): string {
  return renderToString(<Portfolio prerender />)
}

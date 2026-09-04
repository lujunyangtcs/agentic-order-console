import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { Providers } from './app/providers'
import { router } from './app/router'
import 'leaflet/dist/leaflet.css'
import './index.css'

/* `?motion=reduce` mirrors the OS preference onto an attribute the stylesheet
 * also honours. It exists because JavaScript cannot flip
 * `prefers-reduced-motion`, which makes reduced motion the one accessibility
 * rule that is never actually verified — it is asserted by reading the OS
 * setting back, which proves nothing about the CSS. */
if (new URLSearchParams(location.search).get('motion') === 'reduce') {
  document.documentElement.setAttribute('data-motion', 'reduce')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
)

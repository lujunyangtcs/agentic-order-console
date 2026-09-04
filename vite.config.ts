import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// import.meta.dirname, not new URL().pathname — a repo path containing a space
// gets percent-encoded by .pathname into a directory that does not exist.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  /* 3041, not the donor's 3040: a port clash discovered mid-rehearsal is a
   * five-minute detour for zero benefit. */
  server: { port: 3041 },
  /* The audit runs against the production bundle, never dev. Pinned so the
   * verification walks always know where to look. */
  preview: { port: 4173, strictPort: true },
})

// Bundles the SSH server (ssh/main.ts) with the shared shell code into
// ssh/dist/main.js. Only ssh2 stays external; it ships in ssh/node_modules.
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  publicDir: false,
  ssr: { noExternal: true, external: ['ssh2'] },
  build: {
    ssr: 'ssh/main.ts',
    outDir: 'ssh/dist',
    emptyOutDir: false,
    target: 'node22',
    minify: false,
    rollupOptions: { output: { entryFileNames: 'main.js', format: 'es' } },
  },
})

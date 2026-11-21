import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The browser only talks to Vite. Vite forwards every /api call to Flask,
// so there is no CORS problem. API_URL lets you point at another backend.
const API_URL = process.env.API_URL || 'http://localhost:5001'

export default defineConfig({
  plugins: [react()],
  build: {
    // Two big libraries are loaded only on the screens that need them, so their size is fine:
    // three.js (~620 kB: the voice call and the 3D vector map) and Excalidraw (~2.9 MB with its
    // diagram add-ons: only the whiteboard round, see components/whiteboard/Board.jsx).
    chunkSizeWarningLimit: 2000,
  },
  // The Python runner is a module worker (src/lib/pythonWorker.js), so build workers as modules.
  worker: { format: 'es' },
  server: {
    port: 5173,
    proxy: {
      '/api': API_URL,
    },
  },
})

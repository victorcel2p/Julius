import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base is set to './' so the build works when hosted in a GitHub Pages
// project subpath (e.g. https://usuario.github.io/julius/).
export default defineConfig({
  plugins: [react()],
  base: './',
})

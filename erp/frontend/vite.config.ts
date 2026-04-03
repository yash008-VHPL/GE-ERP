import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      './cjs/react-jsx-runtime.production.js': path.resolve('./node_modules/react/jsx-runtime'),
      './cjs/react-jsx-runtime.development.js': path.resolve('./node_modules/react/jsx-dev-runtime'),
    }
  }
})

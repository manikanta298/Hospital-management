import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// In development the API runs on :8000; /api and /storage are proxied so the session cookie is same-origin.
export default defineConfig({ plugins: [react()], server: { port: 5173, proxy: { '/api': 'http://localhost:8000', '/storage': 'http://localhost:8000' } } });

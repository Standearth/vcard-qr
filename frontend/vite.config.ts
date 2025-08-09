import { defineConfig, ServerOptions } from 'vite';
import fs from 'fs';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isProduction = command === 'build';

  // Define paths to the development certificate
  const keyPath = path.resolve(__dirname, '../server/certs/localhost.key');
  const certPath = path.resolve(__dirname, '../server/certs/localhost.pem');

  // Conditionally configure the server
  const server: ServerOptions = {
    proxy: {
      '/api': {
        target: 'https://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  };

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    server.https = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  }

  return {
    base: '/',
    build: {
      outDir: 'dist',
    },
    server, // Use the configured server object
    define: {
      'import.meta.env.VITE_API_BASE_URL': isProduction
        ? JSON.stringify('https://pkpass.stand.earth')
        : JSON.stringify(''),
    },
  };
});

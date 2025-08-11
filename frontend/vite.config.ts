import { defineConfig, ServerOptions, loadEnv } from 'vite';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Function to get local network IPs
const getLocalNetworkIPs = (): string[] => {
  const nets = os.networkInterfaces();
  const results: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
};

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  const env = loadEnv(mode, process.cwd(), '');

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

  // Determine the API base URL
  let apiBaseUrl = '';
  if (isProduction) {
    apiBaseUrl = `https://${env.BACKEND_DOMAIN}`;
  } else {
    // For development, dynamically determine the local IP
    const localIp = getLocalNetworkIPs()[0] || 'localhost';
    const backendPort = env.PORT || 3000;
    apiBaseUrl = `https://${localIp}:${backendPort}`;
  }

  return {
    envDir: '../',
    base: '/',
    build: {
      outDir: 'dist',
    },
    server, // Use the configured server object
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
  };
});

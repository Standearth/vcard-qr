import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isProduction = command === 'build';

  return {
    base: '/',
    build: {
      outDir: 'dist',
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              if (req.headers.host) {
                const host = req.headers.host.split(':')[0];
                options.target = `http://${host}:3000`;
              }
            });
          },
        },
      },
    },
    // Define a global constant to hold the API base URL
    define: {
      'import.meta.env.VITE_API_BASE_URL': isProduction
        ? JSON.stringify('https://pkpass.stand.earth')
        : JSON.stringify(''),
    },
  };
});

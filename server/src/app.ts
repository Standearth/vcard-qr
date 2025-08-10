import express, { Express } from 'express';
import cors from 'cors';
import os from 'os'; // Import the 'os' module
import vcardPassRouter from './api/pass.router.js';
import photoRouter from './api/photo.router.js';

const app: Express = express();

// --- CORS Configuration ---

// Function to get local network IPs
const getLocalNetworkIPs = (): string[] => {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
};

// Start with the base origins
const allowedOrigins = [
  'http://localhost:5173',
  'https://localhost:5173',
  `https://${process.env.FRONTEND_DOMAIN}`,
];

// In development, dynamically add local network IPs to the allowed list
if (process.env.NODE_ENV !== 'production') {
  const localIPs = getLocalNetworkIPs();
  localIPs.forEach((ip) => {
    allowedOrigins.push(`http://${ip}:5173`);
    allowedOrigins.push(`https://${ip}:5173`);
  });
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
};

app.use(cors(corsOptions));
app.use(express.json());

// Mount the API routers
app.use('/api/v1/passes/vcard', vcardPassRouter);
app.use('/api/v1/photo', photoRouter);

export default app;

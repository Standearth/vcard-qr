import axios from 'axios';
import https from 'https';

// Create a custom axios instance
const api = axios.create();

// In development, configure the agent to ignore self-signed certificate errors
if (process.env.NODE_ENV !== 'production') {
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });
  api.defaults.httpsAgent = httpsAgent;
}

export default api;

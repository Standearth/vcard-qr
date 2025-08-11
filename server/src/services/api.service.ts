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

/**
 * Determines the appropriate base URL for the internal photo service API.
 * In development, it constructs the URL from the incoming request.
 * In production, it uses the PHOTO_SERVICE_URL environment variable.
 *
 * @param req The Express request object.
 * @returns The base URL for the photo service.
 */
export function getPhotoServiceUrl(req: any): string {
  if (process.env.NODE_ENV === 'production') {
    return process.env.PHOTO_SERVICE_URL || `https://${req.get('host')}`;
  }
  return `${req.protocol}://${req.get('host')}`;
}

export default api;

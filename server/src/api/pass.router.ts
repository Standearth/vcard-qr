// src/api/pass.router.ts
import { Router, Request } from 'express';
import { generatePassBuffer } from '../services/pass.service.js';
import { PassData } from '../types/index.js';
import api, { getPhotoServiceUrl } from '../services/api.service.js';

const router: Router = Router();

/**
 * Looks up a photo from the photo service API.
 * @param name The full name of the person to look up.
 * @param req The Express Request object, used to construct the API URL.
 * @returns A Buffer of the photo data, or null if not found or an error occurs.
 */
const lookupPhoto = async (
  name: string,
  req: Request
): Promise<Buffer | null> => {
  let photoBuffer: Buffer | null = null;
  const photoApiUrl = `${getPhotoServiceUrl(req)}/api/v1/photo`;

  // Gracefully fail when no name is included in the pass
  if (name.trim() == '') {
    console.log('No name provided, skipping photo lookup.');
    return null;
  }

  try {
    const photoResponse = await api.get(photoApiUrl, {
      params: { name },
      responseType: 'arraybuffer',
    });

    if (photoResponse.status === 200) {
      photoBuffer = Buffer.from(photoResponse.data);
    }
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      console.log(`Photo not found for "${name}", continuing without it.`);
    } else {
      console.error(
        'An error occurred while fetching the photo via API:',
        error
      );
    }
  }
  return photoBuffer;
};

router.post('/', async (req, res) => {
  try {
    const passData: PassData = req.body;
    const fullName = `${passData.firstName} ${passData.lastName}`.trim();
    const photoBuffer = await lookupPhoto(fullName, req); // Pass req to the helper
    const passBuffer = await generatePassBuffer(passData, photoBuffer);
    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="vCard.pkpass"`,
    });
    res.status(200).send(passBuffer);
  } catch (error) {
    console.error('Error generating pass:', error);
    res.status(500).send('Failed to generate pass.');
  }
});

export default router;

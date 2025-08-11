// src/api/pass.router.ts
import { Router } from 'express';
import { generatePassBuffer } from '../services/pass.service.js';
import { PassData } from '../types/index.js';
import api, { getPhotoServiceUrl } from '../services/api.service.js';

const router: Router = Router();

router.post('/', async (req, res) => {
  try {
    const passData: PassData = req.body;

    const fullName = `${passData.firstName} ${passData.lastName}`;
    let photoBuffer: Buffer | null = null;

    const photoApiUrl = `${getPhotoServiceUrl(req)}/api/v1/photo`;

    try {
      const photoResponse = await api.get(photoApiUrl, {
        params: { name: fullName },
        responseType: 'arraybuffer',
      });

      if (photoResponse.status === 200) {
        photoBuffer = Buffer.from(photoResponse.data);
      }
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        console.log(
          `Photo not found for "${fullName}", continuing without it.`
        );
      } else {
        console.error(
          'An error occurred while fetching the photo via API:',
          error
        );
      }
    }

    const passBuffer = await generatePassBuffer(passData, photoBuffer);

    const fileName = `${fullName.replace(/[^a-z0-9]/gi, '_')}.pkpass`;
    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    res.status(200).send(passBuffer);
  } catch (error) {
    console.error('Error generating pass:', error);
    res.status(500).send('Failed to generate pass.');
  }
});

export default router;

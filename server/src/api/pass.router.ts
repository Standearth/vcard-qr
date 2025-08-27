// src/api/pass.router.ts
import { Router } from 'express';
import { generatePassBuffer } from '../services/pass.service.js';
import { generateGoogleWalletPass } from '../services/google-wallet.service.js';
import { PassData } from '../types/index.js';
import api from '../services/api.service.js';
import { AxiosError } from 'axios';

const router: Router = Router();

/**
 * Looks up a photo from a service, determined by the user's email domain.
 * @param name The full name of the person to look up.
 * @param email The email address of the person, used for domain-to-service mapping.
 * @returns A Buffer of the photo data, or null if no match is found or an error occurs.
 */
const lookupPhoto = async (
  name: string,
  email: string | undefined
): Promise<Buffer | null> => {
  if (!email) {
    console.log('No email provided, skipping photo lookup.');
    return null;
  }

  const emailDomain = email.split('@')[1];
  if (!emailDomain) {
    console.log(
      `Could not extract domain from email: "${email}", skipping photo lookup.`
    );
    return null;
  }

  let photoServiceUrl: string | undefined;
  try {
    const serviceMappings = JSON.parse(
      process.env.PHOTO_SERVICE_URL || '{}'
    ) as Record<string, string>;
    photoServiceUrl = serviceMappings[emailDomain];
  } catch (error) {
    console.error(
      'Could not parse PHOTO_SERVICE_URL. It should be a JSON object mapping domains to URLs.',
      error
    );
    return null; // Don't attempt lookup if config is broken
  }

  if (!photoServiceUrl) {
    console.log(
      `No photo service URL configured for domain "${emailDomain}", skipping lookup.`
    );
    return null;
  }

  if (name.trim() === '') {
    console.log('No name provided, skipping photo lookup.');
    return null;
  }

  const photoApiEndpoint = `${photoServiceUrl}/api/v1/photo`;

  try {
    const photoResponse = await api.get<Buffer>(photoApiEndpoint, {
      params: { name },
      responseType: 'arraybuffer',
    });

    if (photoResponse.status === 200) {
      return Buffer.from(photoResponse.data);
    }
    // Axios throws for non-2xx statuses, so this part is unlikely to be reached.
    return null;
  } catch (error: unknown) {
    const axiosError = error as AxiosError;
    if (axiosError.response && axiosError.response.status === 404) {
      console.log(
        `Photo not found for "${name}" at ${photoApiEndpoint}, continuing without it.`
      );
    } else {
      console.error(
        `An error occurred while fetching the photo from ${photoApiEndpoint}:`,
        axiosError.message
      );
    }
    return null;
  }
};

router.post('/', (req, res) => {
  void (async () => {
    try {
      const passData: PassData = req.body as PassData;
      const fullName = `${passData.firstName} ${passData.lastName}`.trim();
      const photoBuffer = await lookupPhoto(fullName, passData.email);
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
  })();
});

router.post('/google', (req, res) => {
  void (async () => {
    try {
      const passData: PassData = req.body as PassData;
      const jwt = await generateGoogleWalletPass(passData);
      res.json({ jwt });
    } catch (error) {
      console.error('Error generating Google Wallet pass:', error);
      res.status(500).send('Failed to generate Google Wallet pass.');
    }
  })();
});

export default router;

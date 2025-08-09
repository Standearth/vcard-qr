// src/api/pass.router.ts
import { Router } from 'express';
import { generatePassBuffer } from '../services/pass.service';
import { findPersonAndPhoto } from '../services/photo.service';
import { PassData } from '../types';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const passData: PassData = req.body;
    if (!passData.firstName || !passData.lastName) {
      return res.status(400).send('First and Last name are required.');
    }

    const fullName = `${passData.firstName} ${passData.lastName}`;

    // 1. Call the Photo Service
    const photoResult = await findPersonAndPhoto(fullName);

    // 2. Call the Pass Service
    const passBuffer = await generatePassBuffer(
      passData,
      photoResult.match ? photoResult.photo : null
    );

    // 3. Send the response
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

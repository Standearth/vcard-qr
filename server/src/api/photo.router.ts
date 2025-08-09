// src/api/photo.router.ts
import { Router } from 'express';
import { findPersonAndPhoto } from '../services/photo.service.js';

const router: Router = Router(); // Add explicit type

router.get('/', async (req, res) => {
  const { name } = req.query;

  if (typeof name !== 'string' || !name) {
    return res.status(400).send('A "name" query parameter is required.');
  }

  try {
    const result = await findPersonAndPhoto(name);

    if (result.match) {
      res.set('Content-Type', 'image/png');
      res.status(200).send(result.photo);
    } else {
      res.status(404).send(`Photo for "${name}" not found.`);
    }
  } catch (error) {
    console.error('Photo lookup failed:', error);
    res.status(500).send('Error looking up photo.');
  }
});

export default router;

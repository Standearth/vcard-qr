// src/index.ts
import express from 'express';
// Rename the import for clarity
import vcardPassRouter from './api/pass.router.js';
import photoRouter from './api/photo.router.js';

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

// Mount the API routers with the new endpoint
// highlight-start
app.use('/api/v1/passes/vcard', vcardPassRouter);
// highlight-end
app.use('/api/v1/photo', photoRouter);

app.listen(port, () => {
  // In a production environment like Cloud Run, the container is listening on this port.
  // The actual public URL is managed by the cloud provider.
  if (process.env.NODE_ENV === 'production') {
    console.log(`Server listening for requests on port ${port}`);
  } else {
    // For local development, provide the full clickable URL.
    console.log(`Server is running on http://localhost:${port}`);
  }
});

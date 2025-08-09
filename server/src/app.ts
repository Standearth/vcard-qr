// src/app.ts
import express from 'express';
import vcardPassRouter from './api/pass.router.js';
import photoRouter from './api/photo.router.js';

const app = express();
app.use(express.json());

// Mount the API routers
app.use('/api/v1/passes/vcard', vcardPassRouter);
app.use('/api/v1/photo', photoRouter);

export default app;

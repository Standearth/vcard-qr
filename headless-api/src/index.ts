import express from 'express';
import cors from 'cors';
import qrRouter from './api/qr.router.js';

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.use('/api/v1/qr', qrRouter);

app.listen(port, () => {
  console.log(`Headless API listening on port ${port}`);
});

// src/index.ts
import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';

const port = process.env.PORT || 3000;

app.listen(port, () => {
  if (process.env.NODE_ENV === 'production') {
    console.log(`Server listening for requests on port ${port}`);
  } else {
    console.log(`Server is running on http://localhost:${port}`);
  }
});

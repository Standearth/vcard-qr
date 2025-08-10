// src/index.ts
import app from './app.js';

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server listening for requests on port ${port}`);
});

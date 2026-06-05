import app from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log(`Photo Memory API running at http://localhost:${env.port}`);
});

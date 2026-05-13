import app from "./routes";
import { startExpirySweeper } from "./workers/expiry-sweeper";

const port = Number(process.env.PORT ?? 3001);

startExpirySweeper();

export default {
  port,
  fetch: app.fetch,
};

console.log(`Server running on http://localhost:${port}`);

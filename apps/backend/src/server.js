import { createServer } from "node:http";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 3001);
const app = createApp();

createServer(app).listen(port, () => {
  console.log(`Medicine reminder backend running on http://localhost:${port}`);
});

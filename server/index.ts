import "dotenv/config";
import { createApp } from "./app.ts";
import { initializeDatabase } from "./db/database.ts";

const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || "127.0.0.1";
initializeDatabase();
createApp().listen(port, host, () =>
  console.log(
    `JSN Designs Business Studio API listening on http://${host}:${port}`,
  ),
);

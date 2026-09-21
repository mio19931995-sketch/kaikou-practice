import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.mjs";
const app = createApp();
if (process.argv.includes("--dev")) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const dist = fileURLToPath(new URL("../dist", import.meta.url));
  app.use(express.static(dist));
  app.get("/{*path}", (_req, res) => res.sendFile(`${dist}/index.html`));
}
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
app.listen(port, host, () => console.log(`开口练习：http://${host}:${port}`));

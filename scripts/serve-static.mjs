// Tiny static server for the Playwright tests: serves the `out/` export the way Netlify does
// (trailing-slash folders resolve to index.html, unknown paths get 404.html). No dependencies.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(process.argv[2] ?? "out");
const PORT = Number(process.env.PORT ?? 4321);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function fileFor(urlPath) {
  const safe = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  const full = join(ROOT, safe);
  if (!full.startsWith(ROOT)) return null;
  if (existsSync(full) && statSync(full).isFile()) return full;
  const index = join(full, "index.html");
  if (existsSync(index)) return index;
  if (existsSync(`${full}.html`)) return `${full}.html`;
  return null;
}

createServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  // Match next.config.js `trailingSlash: true`: /chords → /chords/
  if (!path.endsWith("/") && !extname(path) && fileFor(`${path}/`)) {
    res.writeHead(308, { Location: `${path}/` }).end();
    return;
  }
  const file = fileFor(path);
  const status = file ? 200 : 404;
  const body = file ?? join(ROOT, "404.html");
  res.writeHead(status, { "Content-Type": TYPES[extname(body)] ?? "application/octet-stream" });
  createReadStream(body).pipe(res);
}).listen(PORT, () => console.log(`Serving ${ROOT} on http://localhost:${PORT}`));

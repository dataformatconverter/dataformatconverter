// Local preview that behaves like Cloudflare Pages: extensionless URLs, 404.html and the _headers file.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = new URL("./dist", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const PORT = Number(process.env.PORT ?? 8766);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain" };

const headerLines = (await readFile(join(ROOT, "_headers"), "utf8")).split("\n").slice(1).filter(Boolean);
const headers = Object.fromEntries(headerLines.map((l) => l.trim().split(/:\s(.+)/).slice(0, 2)));

async function read(path) {
  try {
    return await readFile(join(ROOT, path));
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/\\/g, "/");
  const candidates = path === "/" ? ["/index.html"] : extname(path) ? [path] : [`${path}.html`];
  for (const candidate of candidates) {
    const body = await read(candidate);
    if (body) {
      res.writeHead(200, { ...headers, "Content-Type": TYPES[extname(candidate)] ?? "application/octet-stream" });
      res.end(body);
      return;
    }
  }
  res.writeHead(404, { ...headers, "Content-Type": TYPES[".html"] });
  res.end(await read("/404.html"));
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));

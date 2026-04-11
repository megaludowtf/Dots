// Tiny static file server for local preview. No deps — just Node built-ins.
import { createServer } from "node:http";
import { readFile, writeFile, stat, mkdir } from "node:fs/promises";
import { extname, join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
// Allow /__upload to write into ../assets/opensea/ for rasterization output.
const PROJECT_ROOT = resolve(ROOT, "..");
const UPLOAD_DIR = join(PROJECT_ROOT, "assets", "opensea");
const PORT = Number(process.env.PORT || 8787);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".ico":  "image/x-icon",
};

createServer(async (req, res) => {
  try {
    // Tiny binary upload endpoint used by the browser rasterizer.
    // POST /__upload?name=logo.png with a raw binary body.
    if (req.method === "POST" && req.url.startsWith("/__upload")) {
      const u = new URL(req.url, "http://localhost");
      const name = u.searchParams.get("name") || "";
      if (!/^[A-Za-z0-9._-]+\.png$/.test(name)) {
        res.writeHead(400); return res.end("bad name");
      }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(join(UPLOAD_DIR, name), body);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, bytes: body.length, path: join(UPLOAD_DIR, name) }));
    }

    let url = decodeURIComponent(req.url.split("?")[0]);
    if (url === "/" || url.endsWith("/")) url += "index.html";
    const filePath = join(ROOT, url);
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }
    const s = await stat(filePath).catch(() => null);
    if (!s || s.isDirectory()) { res.writeHead(404); return res.end("not found"); }
    const data = await readFile(filePath);
    const mime = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
    res.end(data);
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
}).listen(PORT, () => {
  console.log(`Dots dev server: http://localhost:${PORT}/`);
});

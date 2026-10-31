// Local QA only. The APK serves the same files internally without this process.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../.android-web/out/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(
      new URL(req.url, "http://127.0.0.1").pathname,
    );
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.resolve(root, "." + pathname);
    if (!file.startsWith(path.resolve(root) + path.sep))
      throw new Error("Invalid path");
    const bytes = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(3008, "127.0.0.1", () =>
  console.log("Bundled Android UI preview: http://127.0.0.1:3008"),
);

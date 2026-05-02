import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { onRequestGet as onHealthGet } from "./node-functions/api/health.js";
import { onRequestGet as onChatGet, onRequestPost as onChatPost } from "./node-functions/api/chat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preferredPort = Number(process.env.PORT || 4173);

await loadEnvFile(path.join(__dirname, ".env.local"));
await loadEnvFile(path.join(__dirname, ".env"));

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (url.pathname === "/api/health" && req.method === "GET") {
      return sendWebResponse(res, onHealthGet());
    }

    if (url.pathname === "/api/chat") {
      const request = await toWebRequest(req, url);
      if (req.method === "GET") {
        return sendWebResponse(res, await onChatGet({ request, env: process.env }));
      }
      if (req.method === "POST") {
        return sendWebResponse(res, await onChatPost({ request, env: process.env }));
      }
    }

    return serveStatic(res, url.pathname);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.message : "Server error");
  }
});

const port = await findAvailablePort(preferredPort);
server.listen(port, () => {
  console.log(`Voice web demo running at http://localhost:${port}`);
});

async function loadEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const index = trimmed.indexOf("=");
      if (index <= 0) return;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch {
    // Ignore missing local env files.
  }
}

async function findAvailablePort(startPort) {
  let port = startPort;
  while (!(await isPortFree(port))) {
    port += 1;
  }
  return port;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        tester.close(() => resolve(true));
      })
      .listen(port);
  });
}

async function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(__dirname, safePath);
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const content = await fs.readFile(normalized);
    const ext = path.extname(normalized);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

async function toWebRequest(req, url) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(url, {
    method: req.method,
    headers: req.headers,
    body
  });
}

async function sendWebResponse(res, response) {
  const headers = Object.fromEntries(response.headers.entries());
  res.writeHead(response.status, headers);
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}

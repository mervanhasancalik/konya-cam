const { createServer } = require("node:http");
const { request: httpsRequest } = require("node:https");
const { readFileSync, existsSync, statSync } = require("node:fs");
const { join, extname } = require("node:path");

const DIST = join(__dirname, "dist");
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function serveStatic(res, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;
  const ext = extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  res.end(readFileSync(filePath));
  return true;
}

function proxyStream(req, res, targetPath) {
  const options = {
    hostname: "content.tvkur.com",
    path: targetPath,
    method: req.method,
    headers: {
      "Host": "content.tvkur.com",
      "Referer": "https://player.tvkur.com/",
      "Origin": "https://player.tvkur.com",
      "User-Agent": req.headers["user-agent"] || "",
    },
  };

  const proxy = httpsRequest(options, (upstream) => {
    res.writeHead(upstream.statusCode, upstream.headers);
    upstream.pipe(res);
  });

  proxy.on("error", () => {
    res.writeHead(502);
    res.end("Proxy error");
  });

  req.pipe(proxy);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname.startsWith("/stream")) {
    const targetPath = url.pathname.replace(/^\/stream/, "") + url.search;
    proxyStream(req, res, targetPath);
    return;
  }

  const filePath = join(DIST, url.pathname === "/" ? "index.html" : url.pathname);
  if (serveStatic(res, filePath)) return;

  serveStatic(res, join(DIST, "index.html"));
});

server.listen(PORT, () => {
  console.log(`\n  Konya Cam is running at:\n`);
  console.log(`  http://localhost:${PORT}\n`);
});

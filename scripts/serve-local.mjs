import { createServer } from "node:http";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LOCAL_HOST = "127.0.0.1";
export const LOCAL_PORT = 5173;

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "..");
const defaultBuildRoot = path.join(projectRoot, "dist");

const requiredSecurityHeaders = [
  "content-security-policy",
  "referrer-policy",
  "permissions-policy",
  "x-content-type-options",
  "x-frame-options",
  "cross-origin-resource-policy",
];

const mimeTypes = new Map([
  [".avif", "image/avif"],
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

const noCacheHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

export function parseReleaseHeaders(source) {
  const parsed = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed === "/*") continue;

    const separator = trimmed.indexOf(":");
    if (separator <= 0) continue;

    const name = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!name || !value) continue;
    parsed[name] = value;
  }

  const normalized = new Set(Object.keys(parsed).map((name) => name.toLocaleLowerCase()));
  for (const required of requiredSecurityHeaders) {
    if (!normalized.has(required)) throw new Error(`Release header is missing: ${required}`);
  }
  return Object.freeze(parsed);
}

export async function readReleaseHeaders(buildRoot = defaultBuildRoot) {
  const source = await readFile(path.join(buildRoot, "_headers"), "utf8");
  return parseReleaseHeaders(source);
}

export function contentTypeFor(filePath) {
  return mimeTypes.get(path.extname(filePath).toLocaleLowerCase()) ?? "application/octet-stream";
}

function resolveRequestFile(buildRoot, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://127.0.0.1").pathname);
  } catch {
    return { error: 400 };
  }

  if (pathname.includes("\0") || pathname.includes("\\")) return { error: 400 };
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const absolute = path.resolve(buildRoot, relative);
  const rootPrefix = `${path.resolve(buildRoot)}${path.sep}`;
  if (!absolute.startsWith(rootPrefix)) return { error: 403 };
  return { absolute };
}

function sendBody(response, method, status, body, headers, contentType = "text/plain; charset=utf-8") {
  const bytes = Buffer.from(body);
  response.writeHead(status, {
    ...headers,
    ...noCacheHeaders,
    "Content-Length": String(bytes.byteLength),
    "Content-Type": contentType,
  });
  if (method === "HEAD") response.end();
  else response.end(bytes);
}

export function createReleaseServer({
  buildRoot = defaultBuildRoot,
  releaseHeaders,
  host = LOCAL_HOST,
  expectedPort = LOCAL_PORT,
} = {}) {
  if (!releaseHeaders) throw new Error("Release security headers are required.");

  let allowedAuthority = `${host}:${expectedPort}`;
  const server = createServer(async (request, response) => {
    const method = request.method ?? "GET";
    if (request.headers.host !== allowedAuthority) {
      sendBody(response, method, 421, "Use the exact local address printed by the launcher.\n", releaseHeaders);
      return;
    }
    if (method !== "GET" && method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      sendBody(response, method, 405, "Method not allowed.\n", releaseHeaders);
      return;
    }

    const resolved = resolveRequestFile(buildRoot, request.url ?? "/");
    if (resolved.error) {
      sendBody(response, method, resolved.error, "Invalid local path.\n", releaseHeaders);
      return;
    }

    try {
      const details = await lstat(resolved.absolute);
      if (!details.isFile()) {
        sendBody(response, method, 404, "Not found.\n", releaseHeaders);
        return;
      }
      const body = await readFile(resolved.absolute);
      sendBody(response, method, 200, body, releaseHeaders, contentTypeFor(resolved.absolute));
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
        sendBody(response, method, 404, "Not found.\n", releaseHeaders);
        return;
      }
      sendBody(response, method, 500, "The local release could not be read.\n", releaseHeaders);
    }
  });

  return {
    server,
    setExpectedPort(port) {
      allowedAuthority = `${host}:${port}`;
    },
  };
}

export async function startLocalServer({
  buildRoot = defaultBuildRoot,
  host = LOCAL_HOST,
  port = LOCAL_PORT,
} = {}) {
  await lstat(path.join(buildRoot, "index.html"));
  const releaseHeaders = await readReleaseHeaders(buildRoot);
  const local = createReleaseServer({ buildRoot, releaseHeaders, host, expectedPort: port });

  await new Promise((resolve, reject) => {
    const handleError = (error) => reject(error);
    local.server.once("error", handleError);
    local.server.listen(port, host, () => {
      local.server.off("error", handleError);
      const address = local.server.address();
      if (!address || typeof address === "string") {
        reject(new Error("The local server did not report a usable address."));
        return;
      }
      local.setExpectedPort(address.port);
      resolve();
    });
  });

  const address = local.server.address();
  if (!address || typeof address === "string") throw new Error("The local server did not start.");
  return {
    host,
    port: address.port,
    server: local.server,
    url: `http://${host}:${address.port}/`,
  };
}

export function formatStartError(error) {
  if (error?.code === "EADDRINUSE") {
    return [
      `Port ${LOCAL_PORT} is already in use.`,
      "Stop the older local server in its terminal with Control+C, then run this command again.",
      "This launcher will not stop another process or silently change ports.",
    ].join(" ");
  }
  if (error?.code === "ENOENT") {
    return "The bundled dist release is incomplete. Restore the full download or run npm run build before trying again.";
  }
  return error instanceof Error ? error.message : "The local release could not be started.";
}

async function main() {
  try {
    const local = await startLocalServer();
    console.log(`Fog of Sea is available at ${local.url}`);
    console.log("Keep this terminal open and enter that exact address in your browser.");
    console.log("Press Control+C to stop the local server.");

    const stop = () => {
      console.log("\nStopping the local server.");
      local.server.close();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  } catch (error) {
    console.error(`Unable to start Fog of Sea: ${formatStartError(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) await main();

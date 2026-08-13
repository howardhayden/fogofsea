import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  LOCAL_HOST,
  LOCAL_PORT,
  contentTypeFor,
  formatStartError,
  parseReleaseHeaders,
  startLocalServer,
} from "../scripts/serve-local.mjs";

const publicHeadersUrl = new URL("../public/_headers", import.meta.url);

async function makeReleaseFixture() {
  const buildRoot = await mkdtemp(path.join(tmpdir(), "fog-local-server-"));
  await mkdir(path.join(buildRoot, "assets"));
  await Promise.all([
    writeFile(path.join(buildRoot, "index.html"), "<!doctype html><title>Local fixture</title>"),
    writeFile(path.join(buildRoot, "assets", "app.js"), "document.body.dataset.ready = 'true';"),
    writeFile(path.join(buildRoot, "assets", "app.css"), "body { color: #123; }"),
    writeFile(path.join(buildRoot, "assets", "font.woff2"), Buffer.from([0, 1, 2, 3])),
    writeFile(path.join(buildRoot, "_headers"), await readFile(publicHeadersUrl, "utf8")),
  ]);
  return buildRoot;
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function rawRequest({ port, hostHeader, pathname = "/", method = "GET" }) {
  return new Promise((resolve, reject) => {
    const outgoing = request({
      hostname: LOCAL_HOST,
      port,
      path: pathname,
      method,
      headers: { Host: hostHeader },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        body: Buffer.concat(chunks).toString("utf8"),
        headers: response.headers,
        status: response.statusCode,
      }));
    });
    outgoing.on("error", reject);
    outgoing.end();
  });
}

test("local release launcher has a stable loopback origin", () => {
  assert.equal(LOCAL_HOST, "127.0.0.1");
  assert.equal(LOCAL_PORT, 5173);
});

test("release header parser requires the complete security policy", async () => {
  const parsed = parseReleaseHeaders(await readFile(publicHeadersUrl, "utf8"));
  assert.match(parsed["Content-Security-Policy"], /connect-src 'none'/);
  assert.match(parsed["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(parsed["Referrer-Policy"], "no-referrer");
  assert.equal(parsed["X-Content-Type-Options"], "nosniff");
  assert.throws(() => parseReleaseHeaders("/*\n  Referrer-Policy: no-referrer\n"), /missing/i);
});

test("local release server applies security, MIME, cache, method, and host controls", async (context) => {
  const buildRoot = await makeReleaseFixture();
  const local = await startLocalServer({ buildRoot, port: 0 });
  context.after(async () => {
    await closeServer(local.server);
    await rm(buildRoot, { recursive: true, force: true });
  });

  const page = await fetch(local.url);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(page.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(page.headers.get("referrer-policy"), "no-referrer");
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  assert.equal(page.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.match(page.headers.get("permissions-policy"), /camera=\(\)/);
  assert.match(page.headers.get("content-security-policy"), /connect-src 'none'/);
  assert.match(page.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.match(await page.text(), /Local fixture/);

  const script = await fetch(new URL("assets/app.js", local.url));
  const style = await fetch(new URL("assets/app.css", local.url));
  const font = await fetch(new URL("assets/font.woff2", local.url));
  assert.equal(script.headers.get("content-type"), "text/javascript; charset=utf-8");
  assert.equal(style.headers.get("content-type"), "text/css; charset=utf-8");
  assert.equal(font.headers.get("content-type"), "font/woff2");

  const head = await fetch(local.url, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert(Number(head.headers.get("content-length")) > 0);

  const missing = await fetch(new URL("missing.js", local.url));
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get("content-security-policy"), /connect-src 'none'/);

  const forbiddenMethod = await fetch(local.url, { method: "POST" });
  assert.equal(forbiddenMethod.status, 405);
  assert.equal(forbiddenMethod.headers.get("allow"), "GET, HEAD");

  const wrongHost = await rawRequest({
    port: local.port,
    hostHeader: `localhost:${local.port}`,
  });
  assert.equal(wrongHost.status, 421);
  assert.match(wrongHost.body, /exact local address/i);
});

test("local release server reports an occupied port without selecting another one", async (context) => {
  const buildRoot = await makeReleaseFixture();
  const first = await startLocalServer({ buildRoot, port: 0 });
  context.after(async () => {
    await closeServer(first.server);
    await rm(buildRoot, { recursive: true, force: true });
  });

  await assert.rejects(
    startLocalServer({ buildRoot, port: first.port }),
    (error) => error?.code === "EADDRINUSE",
  );
  assert.match(formatStartError({ code: "EADDRINUSE" }), /will not stop another process or silently change ports/i);
});

test("local release MIME table defaults unknown files to download-safe bytes", () => {
  assert.equal(contentTypeFor("index.html"), "text/html; charset=utf-8");
  assert.equal(contentTypeFor("bundle.js"), "text/javascript; charset=utf-8");
  assert.equal(contentTypeFor("guide.md"), "text/markdown; charset=utf-8");
  assert.equal(contentTypeFor("unknown.bin"), "application/octet-stream");
});

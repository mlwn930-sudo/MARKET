import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

// Run after next build. One process owns server lifetime and HTTP checks.
// This exercises real route rendering and graceful unavailable-provider states.
const port = 3197;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port), "--hostname", "127.0.0.1"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});
let ready = false;
server.stdout.on("data", (chunk) => { if (chunk.toString().includes("Ready")) ready = true; });
server.stderr.on("data", () => {});
let passed = 0;
try {
  for (let i = 0; i < 150 && !ready && server.exitCode === null; i++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, "production server did not start");
  for (const path of ["/", "/launch/ttwo", "/company/NVDA", "/research?ticker=TTWO", "/macro", "/chat", "/news", "/opportunities", "/intel", "/sectors", "/israel", "/watchlist", "/portfolio", "/compare", "/institutional", "/ai", "/brief", "/learn", "/heatmap"]) {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(60_000) });
    const html = await response.text();
    assert.equal(response.status, 200, `${path}: HTTP status`);
    assert.match(html, /<h1[\s>]/, `${path}: page heading missing`);
    assert.doesNotMatch(html, /id="__next_error__"|NEXT_REDIRECT.*\/500|Application error: a server-side exception/, `${path}: render failed`);
    assert.match(html, /id="main-content"/, `${path}: skip-link target missing`);
    assert.doesNotMatch(html, /SEC_USER_AGENT is not set|FINNHUB_API_KEY=|GEMINI_API_KEY=/, `${path}: configuration leaked into page`);
    console.log(`PASS route ${path}`);
    passed++;
  }
  for (const path of ["/api/quotes", "/api/quotes?symbols=123", "/api/history?symbol=NVDA&range=invalid", "/api/history?symbol=bad!&range=1y"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 400, `${path}: invalid request should be rejected`);
    assert.equal(typeof (await response.json()).error, "string");
    console.log(`PASS validation ${path}`);
    passed++;
  }
  const missing = await fetch(base + "/this-route-does-not-exist");
  assert.equal(missing.status, 404);
  console.log("PASS unknown route returns 404");
  passed++;
  console.log(`RESULT ${passed} checks passed`);
} finally {
  const exited = once(server, "exit");
  server.kill("SIGTERM");
  await exited;
}

"use strict";

const http = require("http");
const { createWSS, registerStartCallback } = require("./wsServer");

// 🔒 in-memory job store
const jobs = new Map(); // jobId -> code
const pendingStarts = new Set(); // jobIds waiting for code dispatch

function startJobIfReady(jobId) {
  const code = jobs.get(jobId);
  if (!code) {
    return false;
  }

  const { execute } = require("./jobManager");

  console.log("Executing job:", jobId);
  attachJobListener(jobId);
  execute(jobId, code);

  jobs.delete(jobId);
  pendingStarts.delete(jobId);
  return true;
}

// 👇 create HTTP server
const server = http.createServer((req, res) => {

  // ✅ ONLY route: POST /execute
  if (req.method === "POST" && req.url === "/execute") {

    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      // 🔒 basic protection (avoid huge payloads)
      if (body.length > 1e6) {
        req.socket.destroy();
      }
    });

    req.on("end", () => {
      try {
        const { jobId, code } = JSON.parse(body);

        if (!jobId || !code) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Missing jobId or code" }));
        }

        // 🔒 optional limit
        if (code.length > 5000) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: "Code too large" }));
        }

        // ✅ store job (DO NOT EXECUTE YET)
        jobs.set(jobId, code);

        console.log("Job stored:", jobId);

        if (pendingStarts.has(jobId)) {
          startJobIfReady(jobId);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "queued", jobId }));

      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });

    return;
  }

  // ❌ everything else
  res.writeHead(404);
  res.end();
});


// 👇 attach WebSocket to SAME server
const { attachJobListener } = createWSS(server);


// ✅ execution trigger (ONLY when WS connects)
registerStartCallback((jobId) => {
  const started = startJobIfReady(jobId);
  if (!started) {
    console.log("Code not ready yet for job:", jobId, "- waiting for dispatch");
    pendingStarts.add(jobId);
  }
});


// 🔒 handle port errors properly
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error("Port 3001 already in use");
    process.exit(1);
  }
});


// 🚀 start server
server.listen(3001, () => {
  console.log("Execution service running on port 3001");
});
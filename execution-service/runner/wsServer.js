"use strict";

const WebSocket = require("ws");
const { jobEvents } = require("./jobManager");

let startJobCallback = null;

function registerStartCallback(fn) {
  startJobCallback = fn;
}

// 👇 CHANGE: wrap WS init in a function
function createWSS(server) {
  const wss = new WebSocket.Server({
    server,
    path: "/ws",
  });

  const clients = new Map(); // jobId -> [ws]
  const activeListeners = new Set();

  wss.on("connection", (ws, req) => {
    console.log("New WS connection");

    const query = req.url.split("?")[1];
    const params = new URLSearchParams(query);
    const jobId = params.get("jobId");

    if (!jobId) {
      ws.close();
      return;
    }

    if (!clients.has(jobId)) {
      clients.set(jobId, []);
    }

    clients.get(jobId).push(ws);

    // START JOB on first client
    if (clients.get(jobId).length === 1 && startJobCallback) {
      startJobCallback(jobId);
    }

    ws.on("close", () => {
      const list = clients.get(jobId) || [];
      const updated = list.filter((c) => c !== ws);

      if (updated.length === 0) {
        clients.delete(jobId);
      } else {
        clients.set(jobId, updated);
      }
    });
  });

  function attachJobListener(jobId) {
    if (activeListeners.has(jobId)) return;

    activeListeners.add(jobId);

    jobEvents.on(jobId, (message) => {
      const list = clients.get(jobId) || [];

      list.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      });

      if (message.type === "end") {
        jobEvents.removeAllListeners(jobId);
        clients.delete(jobId);
        activeListeners.delete(jobId);
      }
    });
  }

  return { attachJobListener };
}

module.exports = { createWSS, registerStartCallback };
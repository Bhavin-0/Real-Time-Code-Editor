"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { performance } = require("node:perf_hooks");

const EXECUTION_TIMEOUT_MS = 2000;

function spawnProcess(command, args, options = {}) {
  return spawn(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
}

function waitForClose(child) {
  return new Promise((resolve) => {
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function cleanupContainer(containerName) {
  const kill = spawnProcess("docker", ["kill", containerName], {
    stdio: ["ignore", "ignore", "ignore"],
  });
  await waitForClose(kill);
}

async function executeCode({ code, input = "" }) {
  if (typeof code !== "string") {
    throw new TypeError("code must be a string");
  }

  if (typeof input !== "string") {
    throw new TypeError("input must be a string");
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-run-"));
  const scriptPath = path.join(tempDir, "main.js");

  const containerName = `code-run-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  let timedOut = false;
  let timeoutId;

  try {
    await fs.writeFile(scriptPath, code, "utf8");

    const dockerArgs = [
      "run",
      "--rm",
      "--name",
      containerName,
      "--network=none",
      "--memory=128m",
      "--cpus=0.5",
      "--read-only",
      "--pids-limit=50",
      "--user=1000",
      "-i",
      "--workdir",
      "/workspace",
      "-v",
      `${tempDir}:/workspace:ro`,
      "node:18",
      "node",
      "main.js",
    ];

    // 🔥 START TIMER
    const startTime = performance.now();

    const child = spawnProcess("docker", dockerArgs);

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderrChunks.push(chunk);
    });

    // send input
    if (input.length > 0) {
      child.stdin.write(input);
    }
    child.stdin.end();

    // ⏱️ timeout control
    timeoutId = setTimeout(async () => {
      timedOut = true;
      child.kill("SIGKILL");
      await cleanupContainer(containerName);
    }, EXECUTION_TIMEOUT_MS);

    const exitCode = await waitForClose(child);

    const endTime = performance.now(); // 🔥 END TIMER

    if (timeoutId) clearTimeout(timeoutId);

    let stderr = Buffer.concat(stderrChunks).toString("utf8");

    if (timedOut) {
      stderr = `${stderr}\nExecution timed out after ${EXECUTION_TIMEOUT_MS}ms.`.trim();
    }

    return {
      stdout: Buffer.concat(stdoutChunks).toString("utf8"),
      stderr,
      exitCode,
      executionTime: Math.round(endTime - startTime), // ✅ final
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

module.exports = { executeCode };
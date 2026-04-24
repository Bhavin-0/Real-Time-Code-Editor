"use strict";

const EventEmitter = require("events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { performance } = require("node:perf_hooks");

const jobEvents = new EventEmitter();

const MAX_CODE_LENGTH = 5000;
const EXECUTION_TIMEOUT_MS = 3000;

function emitStdout(jobId, data) {
  jobEvents.emit(jobId, {
    type: "stdout",
    data,
  });
}

function emitStderr(jobId, data) {
  jobEvents.emit(jobId, {
    type: "stderr",
    data,
  });
}

function emitEnd(jobId, exitCode, executionTime) {
  jobEvents.emit(jobId, {
    type: "end",
    exitCode,
    executionTime,
  });
}

function extractExecutionInput(payload, fallbackInput) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return {
      code: typeof payload.code === "string" ? payload.code : "",
      input:
        typeof payload.input === "string"
          ? payload.input
          : typeof fallbackInput === "string"
            ? fallbackInput
            : "",
    };
  }

  if (typeof payload === "string") {
    return {
      code: payload,
      input: typeof fallbackInput === "string" ? fallbackInput : "",
    };
  }

  if (Array.isArray(payload)) {
    const evalIndex = payload.indexOf("-e");
    if (evalIndex >= 0 && typeof payload[evalIndex + 1] === "string") {
      return {
        code: payload[evalIndex + 1],
        input: typeof fallbackInput === "string" ? fallbackInput : "",
      };
    }
  }

  return {
    code: "",
    input: typeof fallbackInput === "string" ? fallbackInput : "",
  };
}

function removeContainer(containerName) {
  const rm = spawn("docker", ["rm", "-f", containerName], {
    stdio: ["ignore", "ignore", "ignore"],
  });
  rm.on("error", () => {});
}

function killContainer(containerName) {
  const kill = spawn("docker", ["kill", "--signal", "SIGKILL", containerName], {
    stdio: ["ignore", "ignore", "ignore"],
  });
  kill.on("error", () => {});
}

function runJob(jobId, payload, input = "") {
  const startTime = performance.now();
  const { code, input: stdinInput } = extractExecutionInput(payload, input);

  if (!code) {
    emitStderr(jobId, "No JavaScript code provided");
    emitEnd(jobId, 1, Math.round(performance.now() - startTime));
    return null;
  }

  if (code.length > MAX_CODE_LENGTH) {
    emitStderr(jobId, "Code size exceeds limit (5000 chars)");
    emitEnd(jobId, 1, Math.round(performance.now() - startTime));
    return null;
  }

  let tempDir;
  const containerName = `runner-${jobId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "-")
    .slice(0, 63);

  try {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "runner-"));
    fs.writeFileSync(path.join(tempDir, "code.js"), code, "utf8");
  } catch (error) {
    emitStderr(jobId, `Failed to prepare execution: ${error.message}`);
    emitEnd(jobId, 1, Math.round(performance.now() - startTime));
    return null;
  }

  const dockerArgs = [
    "run",
    "--rm",
    "--name",
    containerName,
    "--network=none",
    "--memory=128m",
    "--cpus=0.5",
    "--pids-limit=64",
    "--read-only",
    "--tmpfs",
    "/tmp",
    "--security-opt",
    "no-new-privileges",
    "-i",
    "-v",
    `${tempDir}:/app:ro`,
    "node:18",
    "node",
    "/app/code.js",
  ];

  const child = spawn("docker", dockerArgs, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let ended = false;
  let timeoutId;

  const finalize = (exitCode) => {
    if (ended) {
      return;
    }
    ended = true;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    removeContainer(containerName);

    if (tempDir) {
      fs.rm(tempDir, { recursive: true, force: true }, () => {});
    }

    emitEnd(jobId, typeof exitCode === "number" ? exitCode : 1, Math.round(performance.now() - startTime));
  };

  child.stdout.on("data", (data) => {
    emitStdout(jobId, data.toString());
  });

  child.stderr.on("data", (data) => {
    emitStderr(jobId, data.toString());
  });

  child.on("error", (error) => {
    emitStderr(jobId, `Docker execution failed: ${error.message}`);
    finalize(1);
  });

  child.on("close", (code) => {
    finalize(code);
  });

  timeoutId = setTimeout(() => {
    if (ended) {
      return;
    }

    child.kill("SIGKILL");
    killContainer(containerName);
    removeContainer(containerName);
    emitStderr(jobId, "Execution timed out");
  }, EXECUTION_TIMEOUT_MS);

  if (typeof stdinInput === "string" && stdinInput.length > 0) {
    child.stdin.write(stdinInput);
  }
  child.stdin.end();

  return child;
}

const execute = runJob;

module.exports = { jobEvents, runJob, execute };
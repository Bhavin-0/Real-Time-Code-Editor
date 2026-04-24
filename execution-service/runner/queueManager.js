"use strict";

const jobManager = require("./jobManager");

const MAX_PARALLEL = 3;
const queue = [];
let activeWorkers = 0;

if (
  typeof jobManager.execute !== "function" &&
  typeof jobManager.runJob === "function"
) {
  jobManager.execute = jobManager.runJob.bind(jobManager);
}

if (typeof jobManager.execute !== "function") {
  throw new Error("jobManager.execute is not available");
}

if (!jobManager.jobEvents || typeof jobManager.jobEvents.once !== "function") {
  throw new Error("jobManager.jobEvents is not available");
}

function drainQueue() {
  while (activeWorkers < MAX_PARALLEL && queue.length > 0) {
    const next = queue.shift();
    startJob(next);
  }
}

function startJob(job) {
  activeWorkers += 1;

  const onEnd = () => {
    if (activeWorkers > 0) {
      activeWorkers -= 1;
    }
    drainQueue();
  };

  jobManager.jobEvents.once(job.jobId, (message) => {
    if (message && message.type === "end") {
      onEnd();
      return;
    }

    const onMessage = (nextMessage) => {
      if (nextMessage && nextMessage.type === "end") {
        jobManager.jobEvents.removeListener(job.jobId, onMessage);
        onEnd();
      }
    };

    jobManager.jobEvents.on(job.jobId, onMessage);
  });

  try {
    jobManager.execute(job.jobId, job.code);
  } catch {
    onEnd();
    throw new Error(`Failed to execute job ${job.jobId}`);
  }
}

function addJob(jobId, code) {
  if (typeof jobId !== "string" || jobId.length === 0) {
    throw new TypeError("jobId must be a non-empty string");
  }

  if (typeof code !== "string") {
    throw new TypeError("code must be a string");
  }

  queue.push({ jobId, code });
  drainQueue();
}

function getState() {
  return {
    activeWorkers,
    queue: queue.slice(),
  };
}

module.exports = {
  addJob,
  queue,
  getState,
};

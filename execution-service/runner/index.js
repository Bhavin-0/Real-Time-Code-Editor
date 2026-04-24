const { addJob } = require("./queueManager");
const { attachJobListener, registerStartCallback } = require("./wsServer");

function generateJobId() {
  return "job-" + Date.now();
}

const jobId = generateJobId();

// ✅ attach listener FIRST
attachJobListener(jobId);

console.log("Connect WS using:");
console.log(`ws://127.0.0.1:8080/ws?jobId=${jobId}`);

// ✅ register execution trigger
registerStartCallback((incomingJobId) => {
  if (incomingJobId !== jobId) return;

  console.log("Client connected. Delaying execution...");

  // 🔥 CRITICAL: delay execution slightly
  setTimeout(() => {
    console.log("Executing job:", jobId);
    addJob(jobId, `setTimeout(() => console.log("Hello from WS"), 2000)`);

  }, 3000); // small delay to ensure client is ready
});
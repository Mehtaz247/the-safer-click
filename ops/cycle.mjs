import { appendFile, open, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { readJson, root, writeJson } from "../engine/lib.mjs";

const lockPath = path.join(root, ".operator-lock");
let lock;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", env: process.env });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`)));
  });
}

async function record(entry) {
  await appendFile(path.join(root, "state/runs.jsonl"), `${JSON.stringify(entry)}\n`);
}

try {
  lock = await open(lockPath, "wx");
  await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
} catch (error) {
  if (error.code === "EEXIST") throw new Error("Another operator cycle is already running.");
  throw error;
}

const startedAt = new Date().toISOString();
const operator = await readJson("state/operator.json");
operator.lastCycleAt = startedAt;
await writeJson("state/operator.json", operator);
await record({ at: startedAt, type: "cycle", status: "started" });

try {
  await run("npm", ["run", "verify"]);
  const current = await readJson("state/operator.json");
  current.lastSuccessfulCycleAt = new Date().toISOString();
  current.consecutiveFailures = 0;
  await writeJson("state/operator.json", current);
  await record({ at: new Date().toISOString(), type: "cycle", status: "verified", summary: "Content, tests, build, and rendered output passed." });
  console.log("Cycle complete: verified build is ready for publication.");
} catch (error) {
  const current = await readJson("state/operator.json");
  current.consecutiveFailures += 1;
  await writeJson("state/operator.json", current);
  await record({ at: new Date().toISOString(), type: "cycle", status: "failed", error: error.message });
  throw error;
} finally {
  await lock?.close();
  await rm(lockPath, { force: true });
}


import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: 2,
});

const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? "8");
const TASKS_PER_JOB = Number(process.env.TASKS_PER_JOB ?? "0"); 

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processOneTask(jobId: string, taskIndex: number) {
  const ms = 50 + (taskIndex % 25) * 20;
  await sleep(ms);

  await redis.hincrby(`job:${jobId}`, "doneTasks", 1);
  await redis.hset(`job:${jobId}`, { updatedAt: Date.now().toString() });
}

async function runJob(jobId: string) {
  const job = await redis.hgetall(`job:${jobId}`);
  if (!job?.id) return;

  if (job.status === "canceled" || job.status === "done" || job.status === "failed") return;

  await redis.hset(`job:${jobId}`, { status: "running", updatedAt: Date.now().toString() });

  const total = TASKS_PER_JOB > 0 ? TASKS_PER_JOB : Number(job.totalTasks ?? "0");
  const alreadyDone = Number(job.doneTasks ?? "0");

  const remaining = Math.max(0, total - alreadyDone);
  if (remaining === 0) {
    await redis.hset(`job:${jobId}`, { status: "done", updatedAt: Date.now().toString() });
    return;
  }

  let next = alreadyDone + 1;
  let active: Promise<void>[] = [];

  const launch = () => {
    const idx = next++;
    if (idx > total) return;
    const p = processOneTask(jobId, idx).finally(() => {
      active = active.filter((x) => x !== p);
    });
    active.push(p);
  };

  for (let i = 0; i < WORKER_CONCURRENCY; i++) launch();

  while (active.length > 0) {
    await Promise.race(active);
    const current = await redis.hgetall(`job:${jobId}`);
    if (current.status === "canceled") return;
    launch();
  }

  await redis.hset(`job:${jobId}`, { status: "done", updatedAt: Date.now().toString() });
}

async function main() {
  console.log(`Worker started. concurrency=${WORKER_CONCURRENCY}`);

  while (true) {
    const keys = await redis.keys("job:*"); 
    const queued = [];
    for (const k of keys) {
      const status = await redis.hget(k, "status");
      if (status === "queued") queued.push(k);
    }

    const nextJobKey = queued[0];
    if (!nextJobKey) {
      await sleep(500);
      continue;
    }

    const jobId = nextJobKey.replace("job:", "");
    console.log(`Processing job ${jobId}`);
    await runJob(jobId);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

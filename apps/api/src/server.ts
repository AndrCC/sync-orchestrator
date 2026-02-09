import Fastify from 'fastify';
import { z } from 'zod';
import { Redis } from "ioredis";
import { randomUUID } from 'crypto';

const app = Fastify({ logger: true });

// Redis (via docker-compose)
const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: 2,
});

redis.on("error", (err) => app.log.error({ err }, "redis error"));

app.get("/health", async () => {
  const pong = await redis.ping();
  return { ok: true, redis: pong };
});

const CreateJobSchema = z.object({
  tasks: z.number().int().min(1).max(5000),
  concurrency: z.number().int().min(1).max(64).default(8),
});

app.post("/jobs", async (req, reply) => {
  const body = CreateJobSchema.parse(req.body);
  const id = randomUUID();
  const now = Date.now().toString();

  await redis.hset(`job:${id}`, {
    id,
    status: "queued",
    totalTasks: body.tasks.toString(),
    doneTasks: "0",
    failedTasks: "0",
    concurrency: body.concurrency.toString(),
    createdAt: now,
    updatedAt: now,
  });

  reply.code(201).send({ jobId: id });
});

app.get("/jobs/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const job = await redis.hgetall(`job:${id}`);

  if (!job?.id) return reply.code(404).send({ error: "not_found" });
  return job;
});

app.listen({ port: 3000, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

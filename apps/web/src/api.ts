const BASE = "/api";

export type Job = {
  id: string;
  status: string;
  totalTasks: string;
  doneTasks: string;
  failedTasks: string;
  concurrency: string;
  createdAt: string;
  updatedAt: string;
};

export async function createJob(tasks: number, concurrency: number) {
  const res = await fetch(`${BASE}/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tasks, concurrency }),
  });

  if (!res.ok) throw new Error(`createJob failed: ${res.status}`);
  return (await res.json()) as { jobId: string };
}

export async function getJob(jobId: string) {
  const res = await fetch(`${BASE}/jobs/${jobId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getJob failed: ${res.status}`);
  return (await res.json()) as Job;
}

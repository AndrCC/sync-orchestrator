import { useEffect, useMemo, useRef, useState } from "react";
import { createJob, getJob, type Job } from "./api";
import "./App.css";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function App() {
  const [tasks, setTasks] = useState(200);
  const [concurrency, setConcurrency] = useState(8);

  const [jobId, setJobId] = useState<string>("");
  const [job, setJob] = useState<Job | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const progress = useMemo(() => {
    if (!job) return 0;
    const total = Number(job.totalTasks || "0");
    const done = Number(job.doneTasks || "0");
    if (!total) return 0;
    return clamp(Math.round((done / total) * 100), 0, 100);
  }, [job]);

  async function onCreate() {
    setErr("");
    setLoading(true);
    try {
      const res = await createJob(tasks, concurrency);
      setJobId(res.jobId);
      setJob(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!jobId) return;

    let timer: number | undefined;

    const tick = async () => {
      try {
        const j = await getJob(jobId);
        if (!aliveRef.current) return;
        setJob(j);

        if (j && (j.status === "done" || j.status === "failed" || j.status === "canceled")) {
          return;
        }
      } catch (e: unknown) {
        if (!aliveRef.current) return;
        setErr(e instanceof Error ? e.message : "unknown error");
      }

      timer = window.setTimeout(tick, 800);
    };

    tick();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [jobId]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>Sync Orchestrator</h1>
      <p style={{ opacity: 0.8 }}>
        Cria jobs e acompanha progresso (serial vs paralelo no worker).
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          Tasks
          <input
            type="number"
            value={tasks}
            min={1}
            max={5000}
            onChange={(e) => setTasks(Number(e.target.value))}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          Concurrency (meta)
          <input
            type="number"
            value={concurrency}
            min={1}
            max={64}
            onChange={(e) => setConcurrency(Number(e.target.value))}
          />
        </label>

        <button onClick={onCreate} disabled={loading}>
          {loading ? "Criando..." : "Criar Job"}
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid", borderRadius: 8 }}>
          <strong>Erro:</strong> {err}
        </div>
      )}

      {jobId && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid", borderRadius: 8 }}>
          <div><strong>Job ID:</strong> {jobId}</div>

          {!job && <div style={{ marginTop: 8, opacity: 0.8 }}>Carregando status...</div>}

          {job && (
            <>
              <div style={{ marginTop: 8 }}>
                <strong>Status:</strong> {job.status}
              </div>
              <div style={{ marginTop: 8 }}>
                <strong>Progresso:</strong> {job.doneTasks}/{job.totalTasks} ({progress}%)
              </div>

              <div style={{ marginTop: 8, height: 14, border: "1px solid", borderRadius: 999 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    borderRadius: 999,
                  }}
                />
              </div>

              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 12 }}>
                updatedAt: {new Date(Number(job.updatedAt)).toLocaleString()}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

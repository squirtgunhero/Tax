import { writeFileSync } from "node:fs";
const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
async function main() {
  const path = "/api/treasury/debt";
  await fetch(base + path);
  const durations: number[] = [];
  let errors = 0;
  const began = Date.now();
  for (let batch = 0; batch < 5; batch++)
    await Promise.all(
      Array.from({ length: 5 }, async () => {
        const start = Date.now();
        try {
          const r = await fetch(base + path, {
            signal: AbortSignal.timeout(30000),
          });
          const d = await r.json();
          if (!r.ok || d.status !== "live") errors++;
        } catch {
          errors++;
        }
        durations.push(Date.now() - start);
      }),
    );
  durations.sort((a, b) => a - b);
  const report = {
    at: new Date().toISOString(),
    base,
    path,
    requests: durations.length,
    concurrency: 5,
    errors,
    totalMs: Date.now() - began,
    p50Ms: durations[Math.floor(durations.length * 0.5)],
    p95Ms: durations[Math.floor(durations.length * 0.95)],
    scope:
      "Small warmed-cache smoke load, not a capacity benchmark or upstream stress test.",
  };
  writeFileSync(
    "docs/load-latest.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
  if (errors) process.exitCode = 1;
}
main();

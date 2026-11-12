import { getDebt, getFiscal } from "./treasury";
import { getNJ } from "./nj";
import { getNJCurrent } from "./nj-current";
import { getProcurement } from "./procurement";
import { listNJBills } from "./nj-legislation";
import { discoverBills } from "./discovery";
import { getPublications } from "./publications";
import { DataError } from "./http";
import { writeObject, storageMode } from "./storage";
import { fiscalYear } from "./model";
export async function ingest() {
  const startedAt = new Date().toISOString();
  const jobs: [string, () => Promise<unknown>][] = [
    ["treasury-debt", getDebt],
    [
      "federal-fiscal",
      () => getFiscal(new URLSearchParams({ year: String(fiscalYear() - 1) })),
    ],
    ["nj-complete-expenditure", () => getNJ(new URLSearchParams())],
    ["nj-complete-revenue", () => getNJ(new URLSearchParams("kind=revenue"))],
    ["nj-current-expenditure", () => getNJCurrent(new URLSearchParams())],
    [
      "nj-current-revenue",
      () => getNJCurrent(new URLSearchParams("kind=revenue")),
    ],
    ["nj-procurement", () => getProcurement(new URLSearchParams())],
    ["nj-legislation", () => listNJBills(new URLSearchParams())],
    ["federal-discovery", () => discoverBills(new URLSearchParams())],
    ["nj-publications", getPublications],
  ];
  const results: {
    id: string;
    ok: boolean;
    durationMs: number;
    code?: string;
  }[] = [];
  // Bounded fan-out rather than one unbounded request per government dataset.
  for (let i = 0; i < jobs.length; i += 2) {
    results.push(
      ...(await Promise.all(
        jobs.slice(i, i + 2).map(async ([id, run]) => {
          const start = Date.now();
          try {
            await run();
            return { id, ok: true, durationMs: Date.now() - start };
          } catch (e) {
            return {
              id,
              ok: false,
              durationMs: Date.now() - start,
              code: e instanceof DataError ? e.code : "INGEST_FAILED",
            };
          }
        }),
      )),
    );
  }
  const report = {
    startedAt,
    completedAt: new Date().toISOString(),
    ok: results.every((r) => r.ok),
    storage: storageMode(),
    results,
  };
  if (storageMode() !== "memory-only") {
    await writeObject(`runs/${Date.now()}.json`, JSON.stringify(report), true);
    await writeObject("runs/latest.json", JSON.stringify(report));
  }
  return report;
}

import { ingest } from "../lib/data/ingest";
import { writeFileSync } from "node:fs";
ingest()
  .then((report) => {
    writeFileSync(
      "docs/ingestion-latest.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  })
  .catch(() => {
    console.error("Ingestion failed; no successful report was produced.");
    process.exitCode = 1;
  });

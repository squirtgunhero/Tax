"use client";
import { useState } from "react";
import { Feedback, Source, useData } from "./common";
import type { extractPDF, getEstimate } from "@/lib/data/documents";
export function PDFReader({
  url,
  label = "Read source page",
}: {
  url: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(1);
  const r = useData<Awaited<ReturnType<typeof extractPDF>>>(
    open
      ? `/api/documents/pdf?${new URLSearchParams({ url, page: String(page) })}`
      : null,
  );
  return (
    <div className="source-reader">
      <button
        className="expand"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Close source text" : label}
      </button>
      {open && (
        <>
          <label>
            PDF page{" "}
            <input
              aria-label="PDF page"
              type="number"
              min="1"
              max={r.data?.totalPages ?? 1000}
              value={page}
              onChange={(e) => {
                const p = Number(e.target.value);
                if (Number.isInteger(p) && p > 0) setPage(p);
              }}
            />
          </label>
          <Feedback {...r} />
          {r.data && (
            <>
              <p className="caption">
                Page {r.data.page} of {r.data.totalPages} · SHA-256{" "}
                {r.data.sha256}
              </p>
              <pre
                className="source-text"
                tabIndex={0}
                role="region"
                aria-label="Extracted source page text"
              >
                {r.data.text}
              </pre>
              <p className="note">{r.data.disclaimer}</p>
              <Source source={r.data.source} />
            </>
          )}
        </>
      )}
    </div>
  );
}
export function EstimateReader({ url }: { url: string | null }) {
  const publication = url
    ? new URL(url).pathname.match(/^\/publication\/(\d+)$/)?.[1]
    : null;
  const [open, setOpen] = useState(false),
    [sheet, setSheet] = useState(0);
  const r = useData<Awaited<ReturnType<typeof getEstimate>>>(
    open && publication
      ? `/api/federal/estimate?publication=${publication}&sheet=${sheet}`
      : null,
  );
  if (!publication) return null;
  const workbook = r.data?.workbook;
  const columns = workbook
    ? [
        ...new Set(
          workbook.rows.flatMap((r) =>
            r.cells
              .filter((c) => c.value !== null)
              .map((c) => c.cell.replace(/[0-9]/g, "")),
          ),
        ),
      ].sort((a, b) => a.length - b.length || a.localeCompare(b))
    : [];
  return (
    <div className="source-reader">
      <button
        className="expand"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open
          ? "Close official estimate"
          : "Read official summary and estimate table"}
      </button>
      {open && (
        <>
          <Feedback {...r} />
          {r.data && (
            <>
              <h4>{r.data.title}</h4>
              {r.data.summary.map((s, i) => (
                <p key={i}>{s}</p>
              ))}
              {workbook && (
                <>
                  <label>
                    Official worksheet{" "}
                    <select
                      value={sheet}
                      onChange={(e) => setSheet(Number(e.target.value))}
                    >
                      {workbook.sheets.map((s) => (
                        <option key={s.index} value={s.index}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="caption">
                    Original worksheet labels and units are retained below.
                    Values are cached workbook values; formulas are not
                    executed.{" "}
                    <a href={workbook.url}>Download original workbook ↗</a>
                  </p>
                  <div
                    className="table-scroll workbook"
                    tabIndex={0}
                    role="region"
                    aria-label="Official fiscal estimate worksheet"
                  >
                    <table>
                      <caption>
                        {workbook.sheets[sheet]?.name} · original cell columns
                      </caption>
                      <thead>
                        <tr>
                          <th>Row</th>
                          {columns.map((c) => (
                            <th key={c}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {workbook.rows
                          .filter((r) => r.cells.some((c) => c.value !== null))
                          .map((row) => (
                            <tr key={row.row}>
                              <th scope="row">{row.row}</th>
                              {columns.map((column) => {
                                const c = row.cells.find(
                                  (c) =>
                                    c.cell.replace(/[0-9]/g, "") === column,
                                );
                                return (
                                  <td key={column} title={c?.cell}>
                                    {c?.value ?? ""}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {workbook.truncated && (
                    <p>
                      Showing the first 200 source rows of {workbook.totalRows}.
                      Use the original workbook for the complete table.
                    </p>
                  )}
                  <p className="caption">Workbook SHA-256: {workbook.sha256}</p>
                </>
              )}
              <p className="note">{r.data.disclaimer}</p>
              <Source source={r.data.source} />
            </>
          )}
        </>
      )}
    </div>
  );
}

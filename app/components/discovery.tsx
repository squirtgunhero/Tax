"use client";
import { useState } from "react";
import { useData, Feedback, Source, Pagination } from "./common";
import type { discoverBills } from "@/lib/data/discovery";
export function FederalDiscovery({
  onSelect,
}: {
  onSelect: (type: string, number: string, congress: string) => void;
}) {
  const [type, setType] = useState("hr"),
    [page, setPage] = useState(1);
  const r = useData<Awaited<ReturnType<typeof discoverBills>>>(
    `/api/federal/discovery?type=${type}&page=${page}`,
  );
  return (
    <section className="editorial-section">
      <h2>Recently updated federal bill records</h2>
      <p>
        Browse official GovInfo bill-status records without an API key.
        Modification order includes proposed and enacted legislation; each
        current action is shown.
      </p>
      <label>
        Chamber{" "}
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option value="hr">House bills</option>
          <option value="s">Senate bills</option>
        </select>
      </label>
      <Feedback {...r} />
      {r.data && (
        <>
          <ul className="document-list">
            {r.data.results.map((b) => (
              <li key={`${b.type}${b.number}`}>
                <button
                  className="record-link"
                  onClick={() =>
                    onSelect(b.type.toLowerCase(), b.number, b.congress)
                  }
                >
                  {b.type} {b.number} · {b.title}
                </button>
                <small>
                  {b.latestAction.actionDate} · {b.latestAction.text}
                </small>
              </li>
            ))}
          </ul>
          {r.data.unavailable.length > 0 && (
            <p className="note">
              {r.data.unavailable.length} selected official records could not be
              loaded; no substitute record was inserted.
            </p>
          )}
          <Pagination page={page} next={r.data.hasNext} onChange={setPage} />
          <p className="caption">{r.data.disclaimer}</p>
          <Source source={r.data.source} />
        </>
      )}
    </section>
  );
}

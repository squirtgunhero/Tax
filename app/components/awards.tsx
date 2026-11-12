"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  useData,
  Feedback,
  Source,
  Pagination,
  format,
  type Awards,
} from "./common";
export function AwardsView({ year }: { year: number }) {
  const [filters, setFilters] = useState({
    q: "",
    recipient: "",
    agency: "",
    category: "contracts",
    state: "",
  });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [year]);
  const params = new URLSearchParams({
    ...applied,
    year: String(year),
    page: String(page),
  });
  const r = useData<Awards>(`/api/federal/awards?${params}`);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setApplied(filters);
    setPage(1);
  };
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">USAspending.gov</span>
          <h2>Explore award commitments</h2>
        </div>
        <span>Federal FY {year}</span>
      </div>
      <p className="intro-small">
        Find who received an award and which agency awarded it. These are
        cumulative award obligations or loan face values, not payments made
        during the selected year.
      </p>
      <form className="filters" onSubmit={submit}>
        <label>
          Keyword
          <input
            value={filters.q}
            maxLength={100}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder="Search descriptions"
          />
        </label>
        <label>
          Recipient
          <input
            value={filters.recipient}
            maxLength={100}
            onChange={(e) =>
              setFilters({ ...filters, recipient: e.target.value })
            }
            placeholder="Recipient name"
          />
        </label>
        <label>
          Awarding agency
          <input
            value={filters.agency}
            maxLength={100}
            onChange={(e) => setFilters({ ...filters, agency: e.target.value })}
            placeholder="Exact agency name"
          />
        </label>
        <label>
          Award category
          <select
            value={filters.category}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value })
            }
          >
            <option value="contracts">Contracts</option>
            <option value="grants">Grants and assistance</option>
            <option value="loans">Loans</option>
            <option value="payments">Direct payments</option>
            <option value="other">Insurance and other assistance</option>
          </select>
        </label>
        <label>
          Place of performance
          <select
            value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value })}
          >
            <option value="">All locations</option>
            <option value="NJ">New Jersey</option>
          </select>
        </label>
        <button className="primary" type="submit">
          Search records ↗
        </button>
      </form>
      <Feedback {...r} />
      {r.data && (
        <>
          <p className="caption">
            Page {page} · ordered by {r.data.measureLabel.toLowerCase()}. The
            year selects awards with activity in that fiscal year.
          </p>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable awards records"
          >
            <table>
              <caption>Official federal award records</caption>
              <thead>
                <tr>
                  <th>Recipient / award</th>
                  <th>Awarding agency</th>
                  <th className="numeric">{r.data.measureLabel}</th>
                </tr>
              </thead>
              <tbody>
                {r.data.results.map((a, i) => (
                  <tr key={`${a.id}-${i}`}>
                    <td>
                      {a.url ? (
                        <a href={a.url}>
                          {a.recipient ?? "Recipient not reported"} ↗
                        </a>
                      ) : (
                        (a.recipient ?? "Recipient not reported")
                      )}
                      <small>{a.id ?? "ID not reported"}</small>
                      <details>
                        <summary>Description and update</summary>
                        <p>{a.description ?? "No description reported."}</p>
                        <p>Last modified: {a.updatedAt ?? "Not reported"}</p>
                        {a.loanSubsidyCost !== null && (
                          <p>
                            Reported loan subsidy cost:{" "}
                            {format(a.loanSubsidyCost)}
                          </p>
                        )}
                      </details>
                    </td>
                    <td>{a.agency ?? "Not reported"}</td>
                    <td className="numeric">{format(a.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!r.data.results.length && <p>No awards matched these filters.</p>}
          <Pagination page={page} next={r.data.hasNext} onChange={setPage} />
          <p className="note">{r.data.disclaimer}</p>
          <Source source={r.data.source} />
        </>
      )}
    </>
  );
}

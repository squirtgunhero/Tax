"use client";
import { useState } from "react";
import {
  useData,
  Feedback,
  Source,
  Pagination,
  format,
  type NJ,
} from "./common";
export function NJView() {
  const [kind, setKind] = useState("expenditure"),
    [year, setYear] = useState(""),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [agency, setAgency] = useState(""),
    [category, setCategory] = useState(""),
    [page, setPage] = useState(1);
  const params = new URLSearchParams({
    kind,
    q: search,
    agency,
    category,
    page: String(page),
    ...(year ? { year } : {}),
  });
  const r = useData<NJ>(`/api/nj/finances?${params}`);
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            New Jersey · Office of Management and Budget
          </span>
          <h2>The state’s financial record</h2>
        </div>
        <span>Agency summaries</span>
      </div>
      <p className="intro-small">
        Explore reported expenditures and revenue by agency, funding source, and
        program. The latest complete year available from this dataset is shown
        first.
      </p>
      <div className="segmented" aria-label="NJ financial measure">
        <button
          aria-pressed={kind === "expenditure"}
          onClick={() => {
            setKind("expenditure");
            setAgency("");
            setCategory("");
            setPage(1);
          }}
        >
          Expenditures
        </button>
        <button
          aria-pressed={kind === "revenue"}
          onClick={() => {
            setKind("revenue");
            setAgency("");
            setCategory("");
            setPage(1);
          }}
        >
          Revenue
        </button>
      </div>
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q);
          setPage(1);
        }}
      >
        <label>
          NJ fiscal year
          <select
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Latest available</option>
            {(
              r.data?.years ?? Array.from({ length: 23 }, (_, i) => 2025 - i)
            ).map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label>
          Agency
          <select
            value={agency}
            onChange={(e) => {
              setAgency(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All agencies</option>
            {r.data?.agencies.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {r.data?.categories.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Search agency or program
          <input
            value={q}
            maxLength={100}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button className="primary">Search records ↗</button>
      </form>
      <Feedback {...r} />
      {r.data && (
        <>
          <div className="nj-total">
            <span>
              FY {r.data.fiscalYear} · {r.data.count} matching classifications
            </span>
            <strong>{format(r.data.total, true)}</strong>
            <p>
              Reported {kind === "expenditure" ? "expenditures" : "revenue"} for
              these filters · agency dataset only
            </p>
          </div>
          <p className="note">
            Includes {format(r.data.federalFundingSubtotal, true)} labeled as
            federal funding. This can overlap federal records. Do not add state
            and federal totals.
          </p>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable nj records"
          >
            <table>
              <caption>NJ OMB {kind} classifications</caption>
              <thead>
                <tr>
                  <th>Agency / program</th>
                  <th>Category / fund</th>
                  <th className="numeric">Reported amount</th>
                </tr>
              </thead>
              <tbody>
                {r.data.results.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.agency}</strong>
                      {a.program && <small>{a.program}</small>}
                    </td>
                    <td>
                      {a.category}
                      <small>
                        {a.fund}
                        {a.federalFunding ? " · federal funding" : ""}
                      </small>
                    </td>
                    <td className="numeric">{format(a.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!r.data.results.length && (
            <p>No classifications matched these filters.</p>
          )}
          <Pagination page={page} next={r.data.hasNext} onChange={setPage} />
          <p className="note">{r.data.disclaimer}</p>
          <Source source={r.data.source} />
        </>
      )}
    </>
  );
}

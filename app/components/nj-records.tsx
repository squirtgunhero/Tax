"use client";
import { useState } from "react";
import { Feedback, Source, Pagination, useData, format } from "./common";
import type { getNJCurrent } from "@/lib/data/nj-current";
import type { getProcurement } from "@/lib/data/procurement";
export function NJCurrentView() {
  const [kind, setKind] = useState("expenditure"),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [agency, setAgency] = useState(""),
    [page, setPage] = useState(1);
  const r = useData<Awaited<ReturnType<typeof getNJCurrent>>>(
    `/api/nj/current?${new URLSearchParams({ kind, q: search, agency, page: String(page) })}`,
  );
  return (
    <>
      <h2>Current NJ agency records</h2>
      <p>
        Explore the newest published reporting period. Expended amounts and
        obligations are shown separately.
      </p>
      <div className="segmented">
        <button
          aria-pressed={kind === "expenditure"}
          onClick={() => {
            setKind("expenditure");
            setPage(1);
          }}
        >
          Expenditures
        </button>
        <button
          aria-pressed={kind === "revenue"}
          onClick={() => {
            setKind("revenue");
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
          {kind === "expenditure" ? "Payee name" : "Revenue description"}
          <input
            value={q}
            maxLength={100}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label>
          Exact agency name
          <input
            value={agency}
            maxLength={100}
            onChange={(e) => {
              setAgency(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <button className="primary">Search current records</button>
      </form>
      <Feedback {...r} />
      {r.data && (
        <>
          <p className="eyebrow">
            NJ FY {r.data.fiscalYear} · through {r.data.throughDate}
          </p>
          <div className="metrics">
            {kind === "expenditure" ? (
              <>
                <div>
                  <span>Reported expended</span>
                  <strong>{format(r.data.summary.expended, true)}</strong>
                </div>
                <div>
                  <span>Reported obligations</span>
                  <strong>{format(r.data.summary.obligated, true)}</strong>
                </div>
              </>
            ) : (
              <div>
                <span>Reported revenue</span>
                <strong>{format(r.data.summary.revenue, true)}</strong>
              </div>
            )}
          </div>
          <p className="caption">
            Totals reflect {r.data.count} classifications matching these
            filters.
          </p>
          <div
            className="table-scroll"
            role="region"
            tabIndex={0}
            aria-label="Current NJ financial records"
          >
            <table>
              <caption>Separate reported financial measures</caption>
              <thead>
                <tr>
                  <th>Agency / recipient or source</th>
                  <th>Category / fund</th>
                  <th className="numeric">
                    {kind === "expenditure" ? "Expended" : "Revenue"}
                  </th>
                  {kind === "expenditure" && (
                    <th className="numeric">Obligations</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {r.data.results.map((a, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{a.agency}</strong>
                      <small>{a.recipient ?? a.description}</small>
                      <small>{a.program}</small>
                    </td>
                    <td>
                      {a.category}
                      <small>{a.fund}</small>
                    </td>
                    <td className="numeric">
                      {format(kind === "expenditure" ? a.expended : a.revenue)}
                    </td>
                    {kind === "expenditure" && (
                      <td className="numeric">{format(a.obligated)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} next={r.data.hasNext} onChange={setPage} />
          <p className="note">{r.data.disclaimer}</p>
          <Source source={r.data.source} />
        </>
      )}
    </>
  );
}
export function ProcurementView() {
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [year, setYear] = useState(""),
    [page, setPage] = useState(1);
  const r = useData<Awaited<ReturnType<typeof getProcurement>>>(
    `/api/nj/procurement?${new URLSearchParams({ q: search, page: String(page), ...(year ? { year } : {}) })}`,
  );
  return (
    <>
      <h2>NJ vendor purchasing</h2>
      <p>
        Purchasing records identify vendors and commodities. This measure
        includes paid, obligated, and reserved amounts; it is not an individual
        contract register.
      </p>
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q);
          setPage(1);
        }}
      >
        <label>
          Vendor name
          <input
            value={q}
            maxLength={100}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label>
          Purchasing fiscal year
          <select
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Latest available</option>
            {r.data?.years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <button className="primary">Search vendors</button>
      </form>
      <Feedback {...r} />
      {r.data && (
        <>
          <div
            className="table-scroll"
            role="region"
            tabIndex={0}
            aria-label="NJ vendor purchasing records"
          >
            <table>
              <caption>FY {r.data.fiscalYear} purchasing records</caption>
              <thead>
                <tr>
                  <th>Vendor / agency</th>
                  <th>Commodity</th>
                  <th className="numeric">Purchasing amount</th>
                </tr>
              </thead>
              <tbody>
                {r.data.results.map((a, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{a.vendor}</strong>
                      <small>{a.agency}</small>
                      <small>Through {a.throughDate}</small>
                    </td>
                    <td>{a.category}</td>
                    <td className="numeric">{format(a.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} next={r.data.hasNext} onChange={setPage} />
          <p className="note">{r.data.disclaimer}</p>
          <Source source={r.data.source} />
        </>
      )}
    </>
  );
}

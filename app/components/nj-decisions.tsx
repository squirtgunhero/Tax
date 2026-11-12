"use client";
import { useState } from "react";
import { useData, Feedback, Source, Pagination } from "./common";
import { PDFReader } from "./documents";
import type {
  listNJBills,
  getNJBill,
  getNJVotes,
} from "@/lib/data/nj-legislation";
function NJVotes({ bill, session }: { bill: string; session: number }) {
  const [chamber, setChamber] = useState("S"),
    [open, setOpen] = useState(false);
  const r = useData<Awaited<ReturnType<typeof getNJVotes>>>(
    open
      ? `/api/nj/votes?${new URLSearchParams({ bill, session: String(session), chamber })}`
      : null,
  );
  return (
    <>
      <button
        className="expand"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Close NJ votes" : "Load recorded NJ votes"}
      </button>
      {open && (
        <>
          <label>
            Chamber{" "}
            <select
              value={chamber}
              onChange={(e) => setChamber(e.target.value)}
            >
              <option value="S">Senate</option>
              <option value="A">General Assembly</option>
            </select>
          </label>
          <Feedback {...r} />
          {r.data && (
            <>
              {!r.data.groups.length && (
                <p>
                  No matching records in the selected archive coverage. This
                  does not prove no vote occurred.
                </p>
              )}
              {r.data.groups.map((g, i) => (
                <details key={i}>
                  <summary>
                    {g.date} · {g.action} ·{" "}
                    {g.ambiguous
                      ? "Ambiguous source grouping"
                      : `${g.totals.yea} Y / ${g.totals.nay} N / ${g.totals.otherOrUnreported} other or blank`}
                  </summary>
                  {g.ambiguous && (
                    <p className="note">
                      Repeated members prevent interpretation as a unique roll
                      call.
                    </p>
                  )}
                  <div
                    className="table-scroll vote-table"
                    tabIndex={0}
                    role="region"
                    aria-label="Individual NJ vote records"
                  >
                    <table>
                      <caption>Source-recorded member choices</caption>
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Source vote code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.members.map((m, j) => (
                          <tr key={j}>
                            <td>{m.name}</td>
                            <td>{m.vote ?? "Not reported"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
              <p className="note">{r.data.disclaimer}</p>
              <Source source={r.data.source} />
            </>
          )}
        </>
      )}
    </>
  );
}
export function NJDecisions() {
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState("");
  const listing = useData<Awaited<ReturnType<typeof listNJBills>>>(
    `/api/nj/bills?${new URLSearchParams({ q: search, page: String(page) })}`,
  );
  const r = useData<Awaited<ReturnType<typeof getNJBill>>>(
    selected ? `/api/nj/bill?bill=${encodeURIComponent(selected)}` : null,
  );
  return (
    <>
      <h2>New Jersey bills and decisions</h2>
      <p>
        Search official legislative bulk records by bill number, synopsis, or
        sponsor. Status codes and original action wording are preserved.
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
          Search NJ bills
          <input
            value={q}
            maxLength={100}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. appropriation or A425"
          />
        </label>
        <button className="primary">Search NJ legislation</button>
      </form>
      <Feedback {...listing} />
      {listing.data && (
        <>
          <ul className="document-list">
            {listing.data.results.map((b) => (
              <li key={b.id}>
                <button
                  className="record-link"
                  onClick={() => setSelected(b.id)}
                >
                  {b.displayNumber} · {b.title}
                </button>
                <small>
                  {b.statusLabel ?? `Official status ${b.statusCode}`} ·{" "}
                  {b.lastAction} · {b.sponsor}
                </small>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            next={listing.data.hasNext}
            onChange={setPage}
          />
          <Source source={listing.data.source} />
        </>
      )}
      <Feedback {...r} />
      {r.data && (
        <article className="bill">
          <h3>
            {r.data.bill.displayNumber} · {r.data.bill.title}
          </h3>
          <p>
            {r.data.bill.statusLabel ??
              `Official status code: ${r.data.bill.statusCode}`}{" "}
            · Last action: {r.data.bill.lastAction}
          </p>
          <a href={r.data.bill.url}>Official NJ bill page ↗</a>
          <h4>Sponsors and source status</h4>
          <ul>
            {r.data.bill.sponsors.map((s, i) => (
              <li key={i}>
                {s.name} · {s.type} / {s.status}
                {s.withdrawnAt ? ` · withdrawn ${s.withdrawnAt}` : ""}
              </li>
            ))}
          </ul>
          <h4>Original text and fiscal documents</h4>
          <ul className="document-list">
            {r.data.bill.documents.map((d, i) => (
              <li key={i}>
                {d.url ? (
                  <a href={d.url}>
                    {d.type} · {d.comment ?? "Official bill document"} ↗
                  </a>
                ) : (
                  <span>Document type {d.type} · source link unavailable</span>
                )}
                {d.url && (
                  <PDFReader url={d.url} label="Read original document text" />
                )}
              </li>
            ))}
          </ul>
          <details>
            <summary>Official action history</summary>
            <ol>
              {r.data.bill.actions.map((a, i) => (
                <li key={i}>
                  {a.date} · {a.chamber} · {a.action}
                  {a.comment ? ` · ${a.comment}` : ""}
                </li>
              ))}
            </ol>
          </details>
          <NJVotes bill={r.data.bill.id} session={r.data.session} />
          <p className="note">{r.data.disclaimer}</p>
          <Source source={r.data.source} />
        </article>
      )}
    </>
  );
}

"use client";
import { useState } from "react";
import {
  useData,
  Feedback,
  Source,
  date,
  type Bill,
  type Publications,
} from "./common";
import type { getVote } from "@/lib/data/votes";
function VoteDetail({ vote }: { vote: Bill["bill"]["votes"][number] }) {
  const [open, setOpen] = useState(false),
    [state, setState] = useState("");
  const r = useData<Awaited<ReturnType<typeof getVote>>>(
    open
      ? `/api/federal/vote?${new URLSearchParams({ chamber: vote.chamber, congress: vote.congress, session: vote.sessionNumber, roll: vote.rollNumber })}`
      : null,
  );
  return (
    <div className="vote-detail">
      <button
        className="expand"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Hide individual votes" : "View totals and individual votes"}
      </button>
      {open && (
        <>
          <Feedback {...r} />
          {r.data && (
            <>
              <p>
                <strong>{r.data.vote.result}</strong>
                <br />
                {r.data.vote.question}
              </p>
              <p>
                Yea {r.data.vote.totals.Yea} · Nay {r.data.vote.totals.Nay} ·
                Present {r.data.vote.totals.Present} · Not voting{" "}
                {r.data.vote.totals["Not Voting"]}
              </p>
              {r.data.vote.tieBreaker && <p>{r.data.vote.tieBreaker}</p>}
              <label>
                Filter voters by state{" "}
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  <option value="">All states</option>
                  {[...new Set(r.data.vote.members.map((m) => m.state))]
                    .sort()
                    .map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                </select>
              </label>
              <div
                className="table-scroll vote-table"
                tabIndex={0}
                role="region"
                aria-label="Scrollable individual recorded votes"
              >
                <table>
                  <caption>Individual votes on the recorded question</caption>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>State / party</th>
                      <th>Vote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.data.vote.members
                      .filter((m) => !state || m.state === state)
                      .map((m) => (
                        <tr key={m.id}>
                          <td>{m.name}</td>
                          <td>
                            {m.state} · {m.party}
                          </td>
                          <td>{m.vote}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="note">{r.data.disclaimer}</p>
              <Source source={r.data.source} />
            </>
          )}
        </>
      )}
    </div>
  );
}
export function DecisionsView() {
  const [number, setNumber] = useState(""),
    [type, setType] = useState("hr"),
    [congress, setCongress] = useState("119"),
    [lookup, setLookup] = useState<string | null>(null);
  const r = useData<Bill>(lookup);
  const docs = useData<Publications>("/api/nj/publications");
  return (
    <>
      <span className="eyebrow">Before and after approval</span>
      <h2>Follow the decision, not just the dollars.</h2>
      <p className="intro-small">
        Look up a federal bill to see its current status, original text,
        sponsors, official fiscal estimates, and recorded vote references. Bill
        status does not establish that funds have been spent.
      </p>
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          setLookup(
            `/api/federal/bill?${new URLSearchParams({ number, type, congress })}`,
          );
        }}
      >
        <label>
          Congress
          <input
            type="number"
            min="113"
            max="130"
            required
            value={congress}
            onChange={(e) => setCongress(e.target.value)}
          />
        </label>
        <label>
          Bill type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="hr">H.R.</option>
            <option value="s">S.</option>
            <option value="hjres">H.J.Res.</option>
            <option value="sjres">S.J.Res.</option>
            <option value="hconres">H.Con.Res.</option>
            <option value="sconres">S.Con.Res.</option>
            <option value="hres">H.Res.</option>
            <option value="sres">S.Res.</option>
          </select>
        </label>
        <label>
          Bill number
          <input
            type="number"
            required
            min="1"
            max="99999"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="e.g. 1"
          />
        </label>
        <button className="primary">Look up official bill ↗</button>
      </form>
      <Feedback {...r} />
      {r.data && (
        <article className="bill">
          <span className="eyebrow">
            {r.data.bill.congress}th Congress · {r.data.bill.type}{" "}
            {r.data.bill.number}
          </span>
          <h3>{r.data.bill.title}</h3>
          <p className="bill-status">
            <strong>{r.data.bill.latestAction.text}</strong>
            <br />
            {date(r.data.bill.latestAction.actionDate)}
          </p>
          <p>
            <a href={r.data.bill.url ?? undefined}>Official bill overview ↗</a>{" "}
            ·{" "}
            {r.data.bill.originalTextUrl ? (
              <a href={r.data.bill.originalTextUrl}>
                Original introduced text ↗
              </a>
            ) : (
              <span>Introduced text not listed in source</span>
            )}{" "}
            · <a href={r.data.bill.textVersionsUrl}>All text versions ↗</a>
          </p>
          <h4>Sponsors</h4>
          {r.data.bill.sponsors.map((s) => (
            <p key={s.bioguideId}>
              <a href={`https://www.congress.gov/member/${s.bioguideId}`}>
                {s.fullName} ↗
              </a>
            </p>
          ))}
          <h4>Official fiscal impact</h4>
          {r.data.bill.estimates.length ? (
            <ul className="document-list">
              {r.data.bill.estimates.map((e, i) => (
                <li key={i}>
                  <a href={e.url ?? undefined}>{e.title} ↗</a>
                  <small>
                    {date(e.pubDate)} · {e.description}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No CBO estimate reference is reported in this bill-status record.
              Fiscal impact is unknown.
            </p>
          )}
          <h4>Recorded votes</h4>
          {r.data.bill.votes.length ? (
            <ul className="document-list">
              {r.data.bill.votes.map((v) => (
                <li key={`${v.chamber}-${v.sessionNumber}-${v.rollNumber}`}>
                  <a href={v.url ?? undefined}>
                    {v.chamber} · roll call {v.rollNumber} · {date(v.date)} ↗
                  </a>
                  <small>{v.action}</small>
                  <VoteDetail vote={v} />
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No recorded vote references are present in this source. That does
              not establish that no vote occurred.
            </p>
          )}
          <details>
            <summary>Action history ({r.data.bill.actions.length})</summary>
            <ol className="document-list">
              {r.data.bill.actions.map((a, i) => (
                <li key={i}>
                  {date(a.date)} · {a.text}
                </li>
              ))}
            </ol>
          </details>
          <p className="note">{r.data.disclaimer}</p>
          <Source source={r.data.source} />
        </article>
      )}
      <section className="editorial-section">
        <h2>New Jersey decisions</h2>
        <p>
          Use the Legislature’s official records for bill histories, fiscal
          notes, and votes. Structured NJ legislative and procurement ingestion
          is not connected yet.
        </p>
        <div className="official-links">
          <a href="https://www.njleg.state.nj.us/bill-search">
            Search NJ bills ↗
          </a>
          <a href="https://www.njleg.state.nj.us/voting-records">
            NJ recorded votes ↗
          </a>
          <a href="https://www.njleg.state.nj.us/budget-finance">
            Budget & finance ↗
          </a>
          <a href="https://www.nj.gov/treasury/purchase/">
            State procurement ↗
          </a>
        </div>
        <h3>Official budget and financial publications</h3>
        <Feedback {...docs} />
        {docs.data && (
          <>
            <p className="caption">
              Live index from OMB. Document figures have not been extracted.
              Appropriations authorize spending; they are not expenditures.
            </p>
            <ul className="document-list">
              {docs.data.documents.map((d) => (
                <li key={d.url}>
                  <a href={d.url}>{d.title} ↗</a>
                  <small>
                    {d.collection} · {d.kind.replaceAll("-", " ")}
                  </small>
                </li>
              ))}
            </ul>
            <Source source={docs.data.source} />
          </>
        )}
      </section>
      <section className="editorial-section">
        <h2>Who is responsible?</h2>
        <p>
          Bill sponsors and roll-call records above identify participants in
          legislative decisions. Award records identify awarding agencies. To
          find your elected representatives, use an official address-based
          lookup; a ZIP code alone can cross districts.
        </p>
        <div className="official-links">
          <a href="https://www.house.gov/representatives/find-your-representative">
            Find your House representative ↗
          </a>
          <a href="https://www.senate.gov/senators/">Find your senators ↗</a>
          <a href="https://www.njleg.state.nj.us/legislative-roster">
            NJ legislative roster ↗
          </a>
        </div>
      </section>
    </>
  );
}

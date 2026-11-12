"use client";
import { useData, Feedback } from "./common";
export function SourcesView() {
  const r = useData<{
    sources: {
      id: string;
      mode: string;
      path?: string;
      measure?: string;
      url: string;
    }[];
    note: string;
  }>("/api/sources/status");
  return (
    <>
      <span className="eyebrow">Evidence & methodology</span>
      <h2>A number is only useful with its context.</h2>
      <p className="intro-small">
        Every dataset identifies its source, reporting period, and retrieval
        date. Availability is checked when you request data. Missing information
        stays missing.
      </p>
      <Feedback {...r} />
      {r.data && (
        <>
          <p className="note">{r.data.note}</p>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable sources records"
          >
            <table>
              <caption>Source capabilities, not live health checks</caption>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Connection</th>
                  <th>Measure</th>
                </tr>
              </thead>
              <tbody>
                {r.data.sources.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <a href={s.url}>{s.id.replaceAll("-", " ")} ↗</a>
                      {s.path && (
                        <small>
                          <a href={s.path}>View API response</a>
                        </small>
                      )}
                    </td>
                    <td>{s.mode.replaceAll("-", " ")}</td>
                    <td>{s.measure ?? "Official reference links"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="two-columns editorial-section">
        <section>
          <h3>Different measures, different meanings</h3>
          <dl>
            <dt>Receipts & outlays</dt>
            <dd>Actual federal cash collected and paid during a period.</dd>
            <dt>Obligations & awards</dt>
            <dd>
              Legal commitments. An award can span years; its cumulative value
              is not spending in one fiscal year.
            </dd>
            <dt>Budgets & appropriations</dt>
            <dd>Plans or authority to spend, rather than proof of payment.</dd>
            <dt>Debt</dt>
            <dd>Outstanding borrowing at a point in time.</dd>
          </dl>
        </section>
        <section>
          <h3>Our boundaries</h3>
          <p>
            Federal and NJ figures are never added together. Federal transfers
            can appear in both jurisdictions. This version does not reconcile
            those transfers.
          </p>
          <p>
            NJ agency summaries exclude separate authority datasets. Federal
            fiscal years begin October 1; NJ fiscal years begin July 1.
          </p>
          <p>
            Public Ledger does not trace an individual’s taxes to purchases. No
            SSN, tax credentials, income, or personal financial records are
            collected. Optional 2026 ordinary-income estimates run locally in
            your browser. Address matching requires consent and is sent to
            Census without being stored by Public Ledger.
          </p>
        </section>
      </div>
    </>
  );
}

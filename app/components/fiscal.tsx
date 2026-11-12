"use client";
import {
  useData,
  Feedback,
  Source,
  Bars,
  format,
  date,
  type Fiscal,
  type Debt,
} from "./common";
export function FiscalView({ year }: { year: number }) {
  const f = useData<Fiscal>(`/api/treasury/fiscal?year=${year}`);
  const debt = useData<Debt>("/api/treasury/debt");
  return (
    <>
      <Feedback {...f} />
      {f.data && (
        <>
          <div className="section-heading">
            <span className="eyebrow">Federal · actual cash flow</span>
            <span>
              FY {year} · through {date(f.data.recordDate)}
            </span>
          </div>
          <div className="metrics">
            <div>
              <span>Money collected</span>
              <strong>{format(f.data.revenue, true)}</strong>
              <small>Receipts, fiscal year to date</small>
            </div>
            <div>
              <span>Money spent</span>
              <strong>{format(f.data.outlays, true)}</strong>
              <small>Outlays, fiscal year to date</small>
            </div>
            <div>
              <span>{Number(f.data.deficit) < 0 ? "Surplus" : "Deficit"}</span>
              <strong>{format(Math.abs(Number(f.data.deficit)), true)}</strong>
              <small>
                {Number(f.data.deficit) < 0
                  ? "Receipts above outlays"
                  : "Outlays above receipts"}
              </small>
            </div>
          </div>
          <div className="two-columns">
            <section>
              <h2>Where it comes from</h2>
              <p>Taxes and other federal receipts, after refunds.</p>
              <Bars
                items={f.data.receipts}
                label="Federal receipts by source"
              />
            </section>
            <section>
              <h2>Where it goes</h2>
              <p>Net outlays by department, branch, or reporting group.</p>
              <Bars
                items={f.data.spending}
                label="Federal net outlays by reporting group"
              />
            </section>
          </div>
          <p className="note">{f.data.disclaimer}</p>
          <Source source={f.data.source} />
          <p className="caption">
            Category sources:{" "}
            <a href={f.data.breakdownSources[0]}>Treasury Table 4</a> ·{" "}
            <a href={f.data.breakdownSources[1]}>Treasury Table 5</a>.
            Categories reconcile to the reported totals.
          </p>
        </>
      )}
      <section className="debt">
        <div>
          <span className="eyebrow">A separate measure</span>
          <h2>Debt is the accumulated balance.</h2>
          <p>
            Outstanding debt is measured at a point in time. It is not this
            year’s spending.
          </p>
        </div>
        <div>
          <Feedback {...debt} />
          {debt.data && (
            <>
              <strong className="debt-number">
                {format(debt.data.records[0].tot_pub_debt_out_amt, true)}
              </strong>
              <p>
                Gross federal debt · {date(debt.data.records[0].record_date)}
              </p>
              <details>
                <summary>Debt components and source</summary>
                <p>
                  Held by the public:{" "}
                  {format(debt.data.records[0].debt_held_public_amt)}
                  <br />
                  Intragovernmental holdings:{" "}
                  {format(debt.data.records[0].intragov_hold_amt)}
                </p>
                <Source source={debt.data.source} />
              </details>
            </>
          )}
        </div>
      </section>
    </>
  );
}

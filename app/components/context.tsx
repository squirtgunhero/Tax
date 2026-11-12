"use client";
import { useState } from "react";
import { estimateIncomeTax, type FilingStatus, taxSource } from "@/lib/tax";
import type { locateRepresentatives } from "@/lib/data/representatives";
import { Feedback, Source, format } from "./common";
export function ContextView() {
  const [address, setAddress] = useState(""),
    [consent, setConsent] = useState(false),
    [lookup, setLookup] = useState<{
      loading: boolean;
      error?: string;
      data?: Awaited<ReturnType<typeof locateRepresentatives>>;
    }>({ loading: false });
  const [income, setIncome] = useState(""),
    [status, setStatus] = useState<FilingStatus>("single"),
    [estimate, setEstimate] = useState<ReturnType<
      typeof estimateIncomeTax
    > | null>(null),
    [error, setError] = useState("");
  return (
    <>
      <span className="eyebrow">Optional personal context</span>
      <h2>Your representatives, using official district boundaries.</h2>
      <p>
        Find the current House district, senators, and NJ state legislators for
        a full street address. Your address is not saved by Public Ledger.
      </p>
      <form
        className="filters"
        onSubmit={async (e) => {
          e.preventDefault();
          setLookup({ loading: true });
          try {
            const r = await fetch("/api/representatives", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address, consent }),
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.error ?? "District lookup unavailable");
            setLookup({ loading: false, data: d });
          } catch (e) {
            setLookup({
              loading: false,
              error:
                e instanceof Error ? e.message : "District lookup unavailable",
            });
          }
        }}
      >
        <label>
          Street address, city, state
          <input
            value={address}
            maxLength={200}
            required
            minLength={8}
            autoComplete="off"
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        <label className="consent">
          <input
            type="checkbox"
            checked={consent}
            required
            onChange={(e) => setConsent(e.target.checked)}
          />
          I agree to send this address to the U.S. Census Bureau for matching.
          Public Ledger does not store it; Census may log requests under its own
          policies.
        </label>
        <button className="primary" disabled={lookup.loading}>
          Find my districts
        </button>
      </form>
      <Feedback {...lookup} />
      {lookup.data && (
        <>
          <h3>
            {lookup.data.state} · {lookup.data.district.name}
          </h3>
          <ul className="document-list">
            {lookup.data.representatives.map((m) => (
              <li key={m.id || m.stateDistrict}>
                <a href={m.url ?? undefined}>{m.name} ↗</a>
                <small>
                  {m.chamber} · {m.party} · {m.state}
                </small>
              </li>
            ))}
          </ul>
          {lookup.data.stateDistrict && (
            <>
              <h3>{lookup.data.stateDistrict.name}</h3>
              <ul className="document-list">
                {lookup.data.stateDistrict.members.map((m) => (
                  <li key={m.id}>
                    <a href={m.url}>{m.name} ↗</a>
                    <small>
                      {m.chamber === "S" ? "NJ Senate" : "NJ General Assembly"}{" "}
                      · {m.party}
                    </small>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="note">{lookup.data.disclaimer}</p>
          <Source source={lookup.data.source} />
        </>
      )}
      <section className="editorial-section">
        <span className="eyebrow">
          An estimate, not a verified tax liability
        </span>
        <h2>Illustrate your federal ordinary-income tax.</h2>
        <p>
          This simplified 2026 calculation runs entirely in your browser. Income
          is not submitted to our server. It cannot trace your taxes to
          government purchases.
        </p>
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            try {
              setEstimate(estimateIncomeTax(income, status));
            } catch (e) {
              setEstimate(null);
              setError(e instanceof Error ? e.message : "Enter a valid income");
            }
          }}
        >
          <label>
            Annual ordinary income in USD
            <input
              type="number"
              min="0"
              max="1000000000"
              step="0.01"
              required
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            Filing status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as FilingStatus)}
            >
              <option value="single">Single</option>
              <option value="joint">Married filing jointly</option>
            </select>
          </label>
          <button className="primary">Calculate illustration</button>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {estimate && (
          <>
            <div className="metrics">
              <div>
                <span>Illustrative federal income tax</span>
                <strong>{format(estimate.estimatedTax)}</strong>
                <small>2026 · before credits and other adjustments</small>
              </div>
              <div>
                <span>Standard deduction used</span>
                <strong>{format(estimate.standardDeduction)}</strong>
              </div>
            </div>
            <p>
              Illustrative taxable ordinary income: {format(estimate.taxable)}.
            </p>
            <ul>
              {estimate.bands.map((b, i) => (
                <li key={i}>
                  {format(b.taxable)} taxed at {b.rate}%
                </li>
              ))}
            </ul>
            <p className="note">{estimate.assumptions}</p>
          </>
        )}
        <a href={taxSource.url}>{taxSource.name} ↗</a>
        <p className="caption">
          Verified rate tables: PDF pages 10–11; standard deductions: page 18.
          This model covers tax year 2026 only.
        </p>
      </section>
    </>
  );
}

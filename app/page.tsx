"use client";
import { useState } from "react";
import { FiscalView } from "./components/fiscal";
import { AwardsView } from "./components/awards";
import { NJView } from "./components/nj";
import { DecisionsView } from "./components/decisions";
import { SourcesView } from "./components/sources";
const tabs = [
  "The big picture",
  "Federal awards",
  "New Jersey",
  "Decisions & votes",
  "Sources",
] as const;
export default function Home() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("The big picture");
  const [year, setYear] = useState(
    new Date().getUTCFullYear() + (new Date().getUTCMonth() >= 9 ? 0 : -1),
  );
  return (
    <>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <div className="shell">
        <header className="masthead">
          <a href="/" className="wordmark" aria-label="Public Ledger home">
            <span className="brand-mark" aria-hidden="true">
              ≡
            </span>
            PUBLIC LEDGER<span className="edition">A public record.</span>
          </a>
          <span className="masthead-note">
            Independent. Nonpartisan.
            <br />
            Open to everyone.
          </span>
        </header>
        <div className="hero">
          <div>
            <span className="eyebrow">Public money. Public understanding.</span>
            <h1>
              Follow the money.
              <br />
              <span>Understand the decisions.</span>
            </h1>
            <p>
              Where it comes from. Where it goes. Who decides.
              <br className="desktop-break" /> Explore the official records
              behind federal and New Jersey finances.
            </p>
          </div>
          <div className="hero-aside">
            <span className="tiny-rule" />
            <strong>
              No account.
              <br />
              No personal financial data.
            </strong>
            <p>
              Just public records,
              <br />
              with their sources attached.
            </p>
          </div>
        </div>
        <nav className="navigation" aria-label="Explore Public Ledger">
          {tabs.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-current={tab === t ? "page" : undefined}
            >
              <span className="nav-number">0{i + 1}</span>
              {t}
            </button>
          ))}
        </nav>
        <main id="content" tabIndex={-1}>
          <div className="context-row">
            <span>
              {tab === "New Jersey"
                ? "STATE RECORDS"
                : tab === "Decisions & votes"
                  ? "PUBLIC DECISIONS"
                  : tab === "Sources"
                    ? "SOURCE NOTES"
                    : "FEDERAL RECORDS"}
            </span>
            {(tab === "The big picture" || tab === "Federal awards") && (
              <label>
                Federal fiscal year{" "}
                <select
                  aria-label="Federal fiscal year"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {Array.from(
                    { length: new Date().getUTCFullYear() - 2007 },
                    (_, i) => new Date().getUTCFullYear() + 1 - i,
                  ).map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {tab === "The big picture" && <FiscalView year={year} />}{" "}
          {tab === "Federal awards" && <AwardsView year={year} />}{" "}
          {tab === "New Jersey" && <NJView />}{" "}
          {tab === "Decisions & votes" && <DecisionsView />}{" "}
          {tab === "Sources" && <SourcesView />}
        </main>
        <footer>
          <strong>PUBLIC LEDGER</strong>
          <p>Public records, in public view.</p>
          <span>
            Verified sources. Clear distinctions. No invented figures.
          </span>
          <button
            onClick={() => {
              setTab("Sources");
              document.getElementById("content")?.scrollIntoView();
            }}
          >
            Sources & methodology ↑
          </button>
        </footer>
      </div>
    </>
  );
}

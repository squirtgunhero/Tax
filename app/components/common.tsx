"use client";
import { useEffect, useState } from "react";
import type { getAwards } from "@/lib/data/awards";
import type { getDebt, getFiscal } from "@/lib/data/treasury";
import type { getNJ } from "@/lib/data/nj";
import type { getBill } from "@/lib/data/bills";
import type { getPublications } from "@/lib/data/publications";

export type Fiscal = Awaited<ReturnType<typeof getFiscal>>;
export type Awards = Awaited<ReturnType<typeof getAwards>>;
export type NJ = Awaited<ReturnType<typeof getNJ>>;
export type Bill = Awaited<ReturnType<typeof getBill>>;
export type Debt = Awaited<ReturnType<typeof getDebt>>;
export type Publications = Awaited<ReturnType<typeof getPublications>>;
export type SourceInfo = {
  name: string;
  url: string;
  period: string;
  retrievedAt: string;
  cacheTtlSeconds: number;
  updatedAt?: string;
  documentation?: string | null;
};
export const format = (
  v: string | number | null | undefined,
  compact = false,
) =>
  v == null
    ? "Not reported"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 2 : 0,
      }).format(Number(v));
export const date = (v: string) =>
  new Date(v.length === 10 ? `${v}T12:00:00Z` : v).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
export function useData<T>(url: string | null) {
  const [state, setState] = useState<{
    data?: T;
    error?: string;
    loading: boolean;
  }>({ loading: !!url });
  useEffect(() => {
    if (!url) {
      setState({ loading: false });
      return;
    }
    const controller = new AbortController();
    setState({ loading: true });
    fetch(url, { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Source unavailable");
        return body as T;
      })
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setState({
            error: e instanceof Error ? e.message : "Source unavailable",
            loading: false,
          });
      });
    return () => controller.abort();
  }, [url]);
  return state;
}
export function Feedback({
  loading,
  error,
}: {
  loading: boolean;
  error?: string;
}) {
  return (
    <>
      {loading && (
        <p className="status" role="status">
          Retrieving official records…
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error} No substitute figures are displayed.
        </p>
      )}
    </>
  );
}
export function Source({ source }: { source: SourceInfo }) {
  return (
    <aside className="source">
      <a href={source.url}>{source.name} ↗</a>
      <span>Reporting period: {source.period}</span>
      {source.updatedAt && <span>Source updated {date(source.updatedAt)}</span>}
      {source.documentation && (
        <a href={source.documentation}>
          Dataset definitions and accounting notes ↗
        </a>
      )}
      <span>
        Retrieved {date(source.retrievedAt)} at{" "}
        {new Date(source.retrievedAt).toLocaleTimeString("en-US", {
          timeZone: "UTC",
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        UTC · cache up to {source.cacheTtlSeconds / 60} minutes
      </span>
    </aside>
  );
}
export function Bars({
  items,
  label,
}: {
  items: { name: string; amount: string }[];
  label: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...items].sort((a, b) => Number(b.amount) - Number(a.amount));
  const max = Math.max(...items.map((i) => Math.abs(Number(i.amount))), 1);
  return (
    <div className="bars" aria-label={label}>
      {(expanded ? sorted : sorted.slice(0, 8)).map((r) => (
        <div className="bar-row" key={r.name}>
          <div className="bar-label">
            <span>{r.name}</span>
            <strong title={`$${r.amount} USD`}>{format(r.amount, true)}</strong>
          </div>
          <div
            className={`bar-track ${Number(r.amount) < 0 ? "negative" : ""}`}
            aria-hidden="true"
          >
            <div
              style={{ width: `${(Math.abs(Number(r.amount)) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {sorted.length > 8 && (
        <button
          className="expand"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? "Show fewer groups"
            : `Show all ${sorted.length} reporting groups ↓`}
        </button>
      )}
      <p className="caption">
        Rounded USD amounts. T = trillion; B = billion; M = million. Negative
        values represent net offsets or receipts exceeding outlays.
      </p>
    </div>
  );
}
export function Pagination({
  page,
  next,
  onChange,
}: {
  page: number;
  next: boolean;
  onChange: (p: number) => void;
}) {
  return (
    <div className="pagination">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Previous
      </button>
      <span aria-live="polite">Page {page}</span>
      <button disabled={!next} onClick={() => onChange(page + 1)}>
        Next →
      </button>
    </div>
  );
}

import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(
    {
      checkedAt: new Date().toISOString(),
      sources: [
        {
          id: "federal-awards",
          mode: "on-request",
          path: "/api/federal/awards",
          measure: "award obligations",
          url: "https://www.usaspending.gov/",
        },
        {
          id: "treasury-fiscal",
          mode: "on-request",
          path: "/api/treasury/fiscal",
          measure: "actual fiscal-year-to-date receipts and outlays",
          url: "https://fiscaldata.treasury.gov/",
        },
        {
          id: "treasury-debt",
          mode: "on-request",
          path: "/api/treasury/debt",
          measure: "debt stock",
          url: "https://fiscaldata.treasury.gov/",
        },
        {
          id: "nj-finances",
          mode: "on-request",
          path: "/api/nj/finances",
          measure: "OMB agency revenue and expenditure summaries",
          url: "https://www.nj.gov/transparency/",
        },
        {
          id: "nj-publications",
          mode: "on-request",
          path: "/api/nj/publications",
          measure: "official publication index; no parsed amounts",
          url: "https://www.nj.gov/treasury/omb/",
        },
        {
          id: "bill-lookup",
          mode: "on-request",
          path: "/api/federal/bill?congress=119&type=hr&number=1",
          measure:
            "official bill status, actions, sponsors, CBO references and recorded vote links",
          url: "https://www.govinfo.gov/bulkdata/BILLSTATUS",
        },
        {
          id: "recorded-votes",
          mode: "on-request",
          path: "/api/federal/vote?chamber=House&congress=119&session=1&roll=190",
          measure: "individual roll calls and reconciled chamber totals",
          url: "https://clerk.house.gov/",
        },
        {
          id: "congress-discovery",
          mode: process.env.CONGRESS_API_KEY
            ? "configured-unverified"
            : "requires-key",
          path: "/api/federal/bills",
          url: "https://api.congress.gov/",
        },
        {
          id: "nj-legislation",
          mode: "official-links-only",
          url: "https://www.njleg.state.nj.us/bill-search",
        },
        {
          id: "nj-procurement",
          mode: "official-links-only",
          url: "https://www.nj.gov/treasury/purchase/",
        },
      ],
      note: "This is a capability inventory, not a live health check. On-request sources can fail. Successful responses carry retrieval and reporting dates. Cached retrieval dates are preserved. No cross-jurisdiction grand totals.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

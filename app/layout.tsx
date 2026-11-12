import type { ReactNode } from "react";
import "./globals.css";
export const metadata = {
  title: "Public Ledger — Public money, in public view",
  description:
    "Explore official federal and New Jersey receipts, expenditures, awards, and legislative decisions. No account or personal financial information required.",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

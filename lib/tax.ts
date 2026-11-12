import { decimalCents, dollars } from "./data/model";
export const taxSource = {
  name: "IRS Revenue Procedure 2025-32, section 4.01 and 4.14",
  url: "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf",
  taxYear: 2026,
  pages: [10, 11, 18],
};
const tables = {
  single: {
    deduction: 16100,
    ceilings: [12400, 50400, 105700, 201775, 256225, 640600],
  },
  joint: {
    deduction: 32200,
    ceilings: [24800, 100800, 211400, 403550, 512450, 768700],
  },
};
export type FilingStatus = keyof typeof tables;
export function estimateIncomeTax(income: string, status: FilingStatus) {
  if (!(status in tables)) throw Error("Unsupported filing status");
  const gross = decimalCents(income);
  if (gross < 0n || gross > 1_000_000_000_00n)
    throw Error("Enter annual ordinary income between $0 and $1 billion.");
  const t = tables[status],
    deduction = BigInt(t.deduction) * 100n,
    taxable = gross > deduction ? gross - deduction : 0n;
  const rates = [10n, 12n, 22n, 24n, 32n, 35n, 37n],
    bounds = [...t.ceilings.map((n) => BigInt(n) * 100n), taxable];
  let previous = 0n,
    numerator = 0n;
  const bands = [];
  for (let i = 0; i < rates.length; i++) {
    const upper = bounds[i] < taxable ? bounds[i] : taxable;
    const slice = upper > previous ? upper - previous : 0n;
    if (slice > 0n) {
      numerator += slice * rates[i];
      bands.push({ taxable: dollars(slice), rate: Number(rates[i]) });
    }
    previous = bounds[i];
  }
  return {
    taxYear: 2026,
    filingStatus: status,
    gross: dollars(gross),
    standardDeduction: dollars(deduction),
    taxable: dollars(taxable),
    estimatedTax: dollars((numerator + 50n) / 100n),
    bands,
    source: taxSource,
    assumptions:
      "Illustration of 2026 federal ordinary-income tax before credits, using only the standard deduction for a taxpayer under 65, not blind, not a dependent. Assumes the entered ordinary income equals adjusted gross income before that deduction. Excludes payroll, state/local tax, self-employment tax, capital gains, AMT, credits, other deductions, and special provisions. It is not a tax return calculation or an allocation of your tax dollars to purchases.",
  };
}

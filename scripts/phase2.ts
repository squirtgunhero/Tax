import { listNJBills, getNJBill, getNJVotes } from "../lib/data/nj-legislation";
import { getProcurement } from "../lib/data/procurement";
import { discoverBills } from "../lib/data/discovery";
const jobs = {
  njBills: () => listNJBills(new URLSearchParams("session=2026&q=appropriat")),
  njBill: () => getNJBill(new URLSearchParams("session=2026&bill=A425")),
  njVotes: () =>
    getNJVotes(
      new URLSearchParams("session=2026&bill=A794&chamber=S&year=2026"),
    ),
  procurement: () => getProcurement(new URLSearchParams("q=GRAINGER")),
  discovery: () => discoverBills(new URLSearchParams()),
};
async function main() {
  for (const [name, run] of Object.entries(jobs)) {
    try {
      const r = await run();
      console.log(name, "PASS", JSON.stringify(r).slice(0, 1500));
    } catch (e) {
      console.error(name, "FAIL", e);
      process.exitCode = 1;
    }
  }
}
main();

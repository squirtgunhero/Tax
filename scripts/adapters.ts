import { getAwards } from "../lib/data/awards";
import { getDebt, getFiscal } from "../lib/data/treasury";
import { getNJ } from "../lib/data/nj";
import { getBill } from "../lib/data/bills";
import { getPublications } from "../lib/data/publications";
const tasks: Record<string, () => Promise<unknown>> = {
  awards: () => getAwards(new URLSearchParams("year=2025")),
  debt: getDebt,
  fiscal: () => getFiscal(new URLSearchParams("year=2025")),
  nj: () => getNJ(new URLSearchParams()),
  njRevenue: () => getNJ(new URLSearchParams("kind=revenue")),
  bill: () => getBill(new URLSearchParams("number=1")),
  publications: getPublications,
};
async function main() {
  for (const [name, load] of Object.entries(tasks)) {
    try {
      const d = await load();
      console.log(name, "PASS", JSON.stringify(d).slice(0, 700));
    } catch (e) {
      console.error(name, "FAIL", e);
      process.exitCode = 1;
    }
  }
}
main();

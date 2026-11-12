import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import { cached, DataError, request } from "./http";
import { metadata } from "./model";
const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  processEntities: true,
});
const array = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);
const memberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  party: z.string(),
  state: z.string().length(2),
  vote: z.enum(["Yea", "Nay", "Present", "Not Voting"]),
});
const normalizedSchema = z.object({
  congress: z.string(),
  session: z.string(),
  roll: z.string(),
  question: z.string(),
  result: z.string(),
  date: z.string(),
  members: z.array(memberSchema).min(1),
  totals: z.object({
    Yea: z.number().int(),
    Nay: z.number().int(),
    Present: z.number().int(),
    "Not Voting": z.number().int(),
  }),
  tieBreaker: z.string().nullable(),
});
const choice = (value: string) =>
  ({
    Aye: "Yea",
    Yea: "Yea",
    No: "Nay",
    Nay: "Nay",
    Present: "Present",
    "Not Voting": "Not Voting",
  })[value];
export function normalizeVote(xml: string, chamber: "House" | "Senate") {
  try {
    if (xml.includes("<!DOCTYPE") || XMLValidator.validate(xml) !== true)
      throw Error("Invalid XML");
    const d = parser.parse(xml);
    let result;
    if (chamber === "House") {
      const root = d["rollcall-vote"],
        m = root["vote-metadata"],
        totals = m["vote-totals"]["totals-by-vote"];
      result = {
        congress: m.congress,
        session: m.session.slice(0, 1),
        roll: m["rollcall-num"],
        question: m["vote-question"],
        result: m["vote-result"],
        date: m["action-date"],
        tieBreaker: null,
        members: array(root["vote-data"]["recorded-vote"]).map(
          (v: Record<string, unknown>) => {
            const person = v.legislator as Record<string, string>;
            return {
              id: person["@_name-id"],
              name: person["#text"],
              party: person["@_party"],
              state: person["@_state"],
              vote: choice(v.vote as string),
            };
          },
        ),
        totals: {
          Yea: Number(totals["yea-total"]),
          Nay: Number(totals["nay-total"]),
          Present: Number(totals["present-total"]),
          "Not Voting": Number(totals["not-voting-total"]),
        },
      };
    } else {
      const root = d.roll_call_vote;
      result = {
        congress: root.congress,
        session: root.session,
        roll: root.vote_number,
        question: root.vote_question_text,
        result: root.vote_result_text,
        date: root.vote_date,
        tieBreaker: root.tie_breaker?.by_whom
          ? `${root.tie_breaker.by_whom}: ${root.tie_breaker.tie_breaker_vote}`
          : null,
        members: array(root.members.member).map(
          (v: Record<string, string>) => ({
            id: v.lis_member_id,
            name: `${v.first_name} ${v.last_name}`,
            party: v.party,
            state: v.state,
            vote: choice(v.vote_cast),
          }),
        ),
        totals: {
          Yea: Number(root.count.yeas),
          Nay: Number(root.count.nays),
          Present: Number(root.count.present),
          "Not Voting": Number(root.count.absent),
        },
      };
    }
    const vote = normalizedSchema.parse(result);
    if (new Set(vote.members.map((m) => m.id)).size !== vote.members.length)
      throw Error("Duplicate members");
    for (const k of ["Yea", "Nay", "Present", "Not Voting"] as const)
      if (vote.members.filter((m) => m.vote === k).length !== vote.totals[k])
        throw Error("Vote count mismatch");
    return vote;
  } catch {
    throw new DataError(
      "SCHEMA_CHANGED",
      "Official vote record is invalid or member totals do not reconcile.",
    );
  }
}
export async function getVote(params: URLSearchParams) {
  const p = z
    .object({
      chamber: z.enum(["House", "Senate"]),
      congress: z.coerce.number().int().min(113).max(130),
      session: z.coerce.number().int().min(1).max(2),
      roll: z.coerce.number().int().min(1).max(99999),
    })
    .parse(Object.fromEntries(params));
  return cached(`vote:${JSON.stringify(p)}`, 900000, async () => {
    const year = 1789 + (p.congress - 1) * 2 + p.session - 1;
    const url =
      p.chamber === "House"
        ? `https://clerk.house.gov/evs/${year}/roll${String(p.roll).padStart(3, "0")}.xml`
        : `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${p.congress}${p.session}/vote_${p.congress}_${p.session}_${String(p.roll).padStart(5, "0")}.xml`;
    const vote = normalizeVote(
      (await request(url, {}, true)) as string,
      p.chamber,
    );
    if (
      Number(vote.congress) !== p.congress ||
      Number(vote.session) !== p.session ||
      Number(vote.roll) !== p.roll
    )
      throw new DataError(
        "IDENTITY_MISMATCH",
        "Official vote identifier mismatch.",
      );
    return {
      status: "live",
      chamber: p.chamber,
      vote,
      source: metadata(
        p.chamber === "House"
          ? "Clerk of the U.S. House"
          : "U.S. Senate roll call votes",
        url,
        "recorded-vote",
        vote.date,
      ),
      disclaimer:
        "The recorded question may concern a procedural motion or amendment rather than final passage. A recorded vote does not establish actual expenditure. Senate totals cover senators; any vice-presidential tie-breaking vote is reported separately.",
    };
  });
}

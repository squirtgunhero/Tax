import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import { cached, DataError, json, request } from "./http";
import { metadata } from "./model";
import { njRoster } from "./nj-legislation";
import { officialUrl } from "./bills";
const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  processEntities: true,
});
const many = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);
const houseURL = "https://clerk.house.gov/xml/lists/MemberData.xml",
  senateURL =
    "https://www.senate.gov/general/contact_information/senators_cfm.xml";
export function activeCongress(at = new Date()) {
  const year = at.getUTCFullYear();
  const effective =
    year % 2 === 1 && at.getTime() < Date.parse(`${year}-01-03T17:00:00Z`)
      ? year - 1
      : year;
  return Math.floor((effective - 1789) / 2) + 1;
}
export function parseMembers(xml: string, chamber: "House" | "Senate") {
  if (xml.includes("<!DOCTYPE") || XMLValidator.validate(xml) !== true)
    throw new DataError(
      "INVALID_XML",
      "Official member directory XML is invalid.",
    );
  const d = parser.parse(xml);
  try {
    if (chamber === "House")
      return {
        congress: Number(d.MemberData["title-info"]["congress-num"]),
        members: many<Record<string, unknown>>(d.MemberData.members.member).map(
          (r) => {
            const info = r["member-info"] as Record<string, unknown>;
            return {
              id: String(info.bioguideID ?? ""),
              name: String(info["official-name"] ?? info.namelist ?? "Vacant"),
              party: String(info.party ?? ""),
              stateDistrict: String(r.statedistrict),
              state: String(
                (info.state as Record<string, string>)["@_postal-code"],
              ),
              url: info.bioguideID
                ? `https://www.congress.gov/member/${encodeURIComponent(String(info.bioguideID))}`
                : null,
              chamber: "House",
            };
          },
        ),
      };
    return {
      congress: null,
      members: many<Record<string, string>>(d.contact_information.member).map(
        (r) => ({
          id: r.bioguide_id,
          name: `${r.first_name} ${r.last_name}`,
          party: r.party,
          state: r.state,
          stateDistrict: r.state,
          url: officialUrl(r.website),
          chamber: "Senate",
        }),
      ),
    };
  } catch {
    throw new DataError("SCHEMA_CHANGED", "Official member directory changed.");
  }
}
async function directories() {
  return cached("member-directories", 3600000, async () => {
    const [house, senate] = await Promise.all([
      request(houseURL, {}, true),
      request(senateURL, {}, true),
    ]);
    return {
      house: parseMembers(house as string, "House"),
      senate: parseMembers(senate as string, "Senate"),
      retrievedAt: new Date().toISOString(),
    };
  });
}
const tiger =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer";
export function selectCongressLayer(
  layers: { id: number; name: string }[],
  congress: number,
) {
  const layer = layers.find(
    (l) =>
      l.name ===
      `${congress}${congress % 10 === 1 && congress % 100 !== 11 ? "st" : congress % 10 === 2 && congress % 100 !== 12 ? "nd" : congress % 10 === 3 && congress % 100 !== 13 ? "rd" : "th"} Congressional Districts`,
  );
  if (!layer)
    throw new DataError(
      "BOUNDARY_UNAVAILABLE",
      "Official boundaries for the active Congress are not available.",
      503,
    );
  return layer;
}
export async function locateRepresentatives(input: unknown) {
  const p = z
    .object({
      address: z.string().trim().min(8).max(200),
      consent: z.literal(true),
    })
    .parse(input);
  // Address requests are deliberately not cached, snapshotted, returned, or logged.
  const geocoder =
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
  const geocoded = await json(
    `${geocoder}?${new URLSearchParams({ address: p.address, benchmark: "Public_AR_Current", format: "json" })}`,
    z.object({
      result: z.object({
        addressMatches: z.array(
          z.object({ coordinates: z.object({ x: z.number(), y: z.number() }) }),
        ),
      }),
    }),
  );
  if (geocoded.result.addressMatches.length !== 1)
    throw new DataError(
      "ADDRESS_AMBIGUOUS",
      "Census did not return one unambiguous address match. Verify the full street address, city, and state.",
      422,
    );
  const coordinates = geocoded.result.addressMatches[0].coordinates;
  const layers = await cached("census-legislative-layers", 3600000, () =>
    json(
      `${tiger}?f=json`,
      z.object({
        layers: z.array(z.object({ id: z.number(), name: z.string() })),
      }),
    ),
  );
  const congress = activeCongress(),
    layer = selectCongressLayer(layers.layers, congress);
  const spatial = async (id: number) => {
    const query = new URLSearchParams({
      f: "json",
      geometry: `${coordinates.x},${coordinates.y}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: "false",
    });
    const data = await json(
      `${tiger}/${id}/query?${query}`,
      z.object({
        features: z.array(
          z.object({ attributes: z.record(z.string(), z.unknown()) }),
        ),
      }),
    );
    if (data.features.length !== 1)
      throw new DataError(
        "DISTRICT_AMBIGUOUS",
        "Census did not return one district for the matched location.",
        422,
      );
    return data.features[0].attributes;
  };
  const district = await spatial(layer.id),
    geoid = z
      .string()
      .regex(/^\d{4}$/)
      .parse(district.GEOID);
  const dirs = await directories();
  if (dirs.house.congress !== congress)
    throw new DataError(
      "DIRECTORY_PERIOD_MISMATCH",
      "Member directory and active congressional boundaries do not match.",
      503,
    );

  const state = statePostal(geoid.slice(0, 2));
  const house = dirs.house.members.filter(
    (m) =>
      m.state === state &&
      Number(m.stateDistrict.slice(2)) === Number(geoid.slice(2)),
  );
  const senators = dirs.senate.members.filter((m) => m.state === state);
  let stateDistrict: null | {
    name: string;
    geoid: string;
    members: Awaited<ReturnType<typeof njRoster>>;
  } = null;
  if (state === "NJ") {
    const stateLayer = layers.layers.find((l) =>
      /State Legislative Districts - Upper$/.test(l.name),
    );
    if (!stateLayer)
      throw new DataError(
        "BOUNDARY_UNAVAILABLE",
        "NJ legislative boundaries are unavailable.",
        503,
      );
    const match = await spatial(stateLayer.id),
      id = z.string().parse(match.SLDU);
    const roster = await njRoster();
    stateDistrict = {
      name: String(match.NAME),
      geoid: String(match.GEOID),
      members: roster.filter((m) => Number(m.district) === Number(id)),
    };
  }
  return {
    status: "live",
    state,
    congress,
    district: { name: String(district.NAME), geoid },
    representatives: [...house, ...senators],
    stateDistrict,
    source: metadata(
      "U.S. Census Bureau · geocoder and legislative boundaries",
      tiger,
      "district-boundary",
      layer.name,
      { cacheTtlSeconds: 0 },
    ),
    directorySources: [houseURL, senateURL],
    disclaimer:
      "Address sent to the U.S. Census Bureau only after consent. Public Ledger does not persist the address or returned coordinates. District assignment depends on the Census address match and boundary vintage; verify with the official election authority. ZIP codes alone are not used to infer districts. This identifies representatives, not personal tax jurisdiction or liability.",
  };
}
function statePostal(fips: string) {
  const codes: Record<string, string> = {
    "01": "AL",
    "02": "AK",
    "04": "AZ",
    "05": "AR",
    "06": "CA",
    "08": "CO",
    "09": "CT",
    "10": "DE",
    "11": "DC",
    "12": "FL",
    "13": "GA",
    "15": "HI",
    "16": "ID",
    "17": "IL",
    "18": "IN",
    "19": "IA",
    "20": "KS",
    "21": "KY",
    "22": "LA",
    "23": "ME",
    "24": "MD",
    "25": "MA",
    "26": "MI",
    "27": "MN",
    "28": "MS",
    "29": "MO",
    "30": "MT",
    "31": "NE",
    "32": "NV",
    "33": "NH",
    "34": "NJ",
    "35": "NM",
    "36": "NY",
    "37": "NC",
    "38": "ND",
    "39": "OH",
    "40": "OK",
    "41": "OR",
    "42": "PA",
    "44": "RI",
    "45": "SC",
    "46": "SD",
    "47": "TN",
    "48": "TX",
    "49": "UT",
    "50": "VT",
    "51": "VA",
    "53": "WA",
    "54": "WV",
    "55": "WI",
    "56": "WY",
    "60": "AS",
    "66": "GU",
    "69": "MP",
    "72": "PR",
    "78": "VI",
  };
  const code = codes[fips];
  if (!code)
    throw new DataError(
      "STATE_UNAVAILABLE",
      "Census state/territory code is unsupported.",
      422,
    );
  return code;
}

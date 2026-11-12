import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DataError } from "./http";
import { metric, logFailure } from "./telemetry";
export async function respond(load: () => Promise<unknown>) {
  try {
    const data = await load();
    if (data instanceof Response) return data;
    metric("success");
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    metric("failures");
    const invalid = e instanceof ZodError;
    const status = invalid ? 400 : e instanceof DataError ? e.status : 500;
    if (!invalid)
      logFailure("api", e instanceof DataError ? e.code : "INTERNAL_ERROR");
    return NextResponse.json(
      {
        status: "unavailable",
        code: invalid
          ? "INVALID_QUERY"
          : e instanceof DataError
            ? e.code
            : "INTERNAL_ERROR",
        error: invalid
          ? "Invalid query parameters."
          : e instanceof DataError
            ? e.message
            : "Unable to load data.",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}

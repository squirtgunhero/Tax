import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DataError } from "./http";
export async function respond(load: () => Promise<unknown>) {
  try {
    return NextResponse.json(await load(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const invalid = e instanceof ZodError;
    const status = invalid ? 400 : e instanceof DataError ? e.status : 500;
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

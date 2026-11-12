import { fetch as upstreamFetch, EnvHttpProxyAgent } from "undici";
import { z } from "zod";
import { readSnapshot, saveSnapshot, storageMode } from "./storage";
import { metric, logFailure } from "./telemetry";

export class DataError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}
const dispatcher =
  process.env.HTTPS_PROXY || process.env.HTTP_PROXY
    ? new EnvHttpProxyAgent()
    : undefined;
const cache = new Map<string, { value: unknown; expires: number }>();
const pending = new Map<string, Promise<unknown>>();
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
// Bounded process-local cache; failures never become successful cached responses.
export async function cached<T>(
  key: string,
  ttl: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    metric("cacheHits");
    return hit.value as T;
  }
  if (pending.has(key)) return pending.get(key) as Promise<T>;
  let expiresAt = Date.now() + ttl;
  const job = (async () => {
    if (storageMode() !== "memory-only")
      try {
        const stored = await readSnapshot(key);
        if (stored && stored.expiresAt > Date.now()) {
          expiresAt = stored.expiresAt;
          metric("sharedHits");
          return stored.value as T;
        }
      } catch {
        metric("storageFailures");
        logFailure("snapshot-read", "STORAGE_READ_FAILED");
      }
    const value = await load();
    if (storageMode() !== "memory-only")
      try {
        await saveSnapshot(key, value, ttl);
      } catch {
        metric("storageFailures");
        logFailure("snapshot-write", "STORAGE_WRITE_FAILED");
      }
    return value;
  })()
    .then((value) => {
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { value, expires: expiresAt });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}
export async function request(
  url: string,
  init: { method?: string; body?: string } = {},
  asText: boolean | "bytes" = false,
  transport = upstreamFetch,
  pause = sleep,
): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await transport(url, {
        ...init,
        headers: {
          Accept:
            asText === "bytes" ? "*/*" : asText ? "*/*" : "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        dispatcher,
        signal: AbortSignal.timeout(12000),
        redirect: "error",
      });
    } catch {
      if (attempt < 2) {
        await pause(250 * 2 ** attempt);
        continue;
      }
      throw new DataError(
        "NETWORK_ERROR",
        "Official source could not be reached. Try again later.",
        503,
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        const retry = response.headers.get("retry-after");
        const ms = retry
          ? /^\d+$/.test(retry)
            ? Number(retry) * 1000
            : Date.parse(retry) - Date.now()
          : 250 * 2 ** attempt;
        // Do not retry sooner than requested; return if waiting exceeds the request budget.
        if (ms > 3000)
          throw new DataError(
            "RATE_LIMITED",
            "Official source is busy. Retry later.",
            503,
          );
        await pause(Math.max(0, ms || 250));
        continue;
      }
      throw new DataError(
        `UPSTREAM_${response.status}`,
        `Official source returned HTTP ${response.status}.`,
        response.status === 404 ? 404 : 502,
      );
    }
    const reader = response.body?.getReader();
    if (!reader)
      throw new DataError(
        "EMPTY_RESPONSE",
        "Official source returned an empty response.",
      );
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > (asText === "bytes" ? 32_000_000 : 8_000_000)) {
          await reader.cancel();
          throw new DataError(
            "RESPONSE_TOO_LARGE",
            "Source response exceeds ingestion limit.",
          );
        }
        chunks.push(chunk.value);
      }
    } catch (e) {
      if (e instanceof DataError) throw e;
      throw new DataError(
        "NETWORK_ERROR",
        "Official source response was interrupted.",
        503,
      );
    }
    const buffer = Buffer.concat(chunks);
    if (asText === "bytes") return new Uint8Array(buffer);
    const text = buffer.toString("utf8");
    if (asText) return text;
    try {
      return JSON.parse(text);
    } catch {
      throw new DataError(
        "INVALID_JSON",
        "Official source did not return valid JSON.",
      );
    }
  }
  throw new DataError("UNAVAILABLE", "Official source unavailable.", 503);
}
export async function json<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: { method?: string; body?: string },
): Promise<T> {
  const parsed = schema.safeParse(await request(url, init));
  if (!parsed.success)
    throw new DataError(
      "SCHEMA_CHANGED",
      "Official source response no longer matches the expected schema.",
    );
  return parsed.data;
}

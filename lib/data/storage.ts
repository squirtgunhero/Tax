import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { get, put, list } from "@vercel/blob";
import { z } from "zod";
export const sha256 = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const envelope = z.object({
  version: z.literal(1),
  key: z.string(),
  createdAt: z.number(),
  expiresAt: z.number(),
  sha256: z.string().length(64),
  value: z.unknown(),
});
export type Snapshot = z.infer<typeof envelope>;
export const storageMode = () =>
  process.env.BLOB_READ_WRITE_TOKEN
    ? "private-blob"
    : process.env.LEDGER_DATA_DIR && !process.env.VERCEL
      ? "filesystem"
      : "memory-only";
const localRoot = () => resolve(process.env.LEDGER_DATA_DIR!);
const prefix = () =>
  `ledger/${process.env.VERCEL_ENV === "production" ? "production" : "development"}/v1/`;
function safePath(path: string) {
  if (!/^[a-z0-9/._-]+$/.test(path) || path.includes(".."))
    throw Error("Invalid storage path");
  return path;
}
export async function readObject(path: string): Promise<string | null> {
  safePath(path);
  if (storageMode() === "private-blob") {
    const result = await get(prefix() + path, {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const response = new Response(result.stream);
    return response.text();
  }
  if (storageMode() === "filesystem") {
    try {
      return await readFile(join(localRoot(), path), "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  return null;
}
export async function writeObject(
  path: string,
  text: string,
  immutable = false,
) {
  safePath(path);
  if (storageMode() === "private-blob") {
    try {
      await put(prefix() + path, text, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: !immutable,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
    } catch (e) {
      if (!immutable) throw e;
      const prior = await readObject(path);
      if (prior !== text) throw e;
    }
  } else if (storageMode() === "filesystem") {
    const file = join(localRoot(), path);
    await mkdir(resolve(file, ".."), { recursive: true });
    if (immutable) {
      try {
        await writeFile(file, text, { flag: "wx" });
      } catch (e) {
        if (
          (e as NodeJS.ErrnoException).code !== "EEXIST" ||
          (await readFile(file, "utf8")) !== text
        )
          throw e;
      }
    } else {
      const temporary = `${file}.${randomUUID()}.tmp`;
      await writeFile(temporary, text);
      await rename(temporary, file);
    }
  }
}
export async function listObjects(path: string, limit = 20) {
  safePath(path);
  if (storageMode() === "private-blob") {
    const result = await list({ prefix: prefix() + path, limit });
    return result.blobs.map((b) => b.pathname.slice(prefix().length));
  }
  if (storageMode() === "filesystem") {
    try {
      return (await readdir(join(localRoot(), path)))
        .sort()
        .slice(-limit)
        .map((n) => path + n);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
  return [];
}
export function parseSnapshot(text: string, key: string) {
  const s = envelope.parse(JSON.parse(text));
  if (s.key !== key || sha256(JSON.stringify(s.value)) !== s.sha256)
    throw Error("Snapshot checksum or identity mismatch");
  return s;
}
export async function readSnapshot(key: string) {
  const text = await readObject(`cache/${sha256(key)}.json`);
  return text ? parseSnapshot(text, key) : null;
}
export async function saveSnapshot(key: string, value: unknown, ttl: number) {
  const createdAt = Date.now(),
    hash = sha256(JSON.stringify(value));
  const s: Snapshot = {
    version: 1,
    key,
    createdAt,
    expiresAt: createdAt + ttl,
    sha256: hash,
    value,
  };
  const encoded = JSON.stringify(s);
  const path = `snapshots/${sha256(key)}/${createdAt}-${hash}.json`;
  await writeObject(path, encoded, true);
  await writeObject(`cache/${sha256(key)}.json`, encoded);
  return s;
}

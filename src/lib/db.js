// Unified data layer.
//
// In production (Vercel), set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// (free tier on Vercel Marketplace) and the whole app state is stored as a
// single JSON document in Redis under REDIS_KEY.
//
// In local dev, with no Upstash env vars set, we fall back to a JSON file on
// disk (data/db.json) via lowdb. This is NOT persistent on serverless
// platforms between invocations — it's only meant for `npm run dev`.
//
// Because the whole app state is ONE document, two requests that land at the
// same moment would each read it, change their own copy, and write it back —
// and the second write would silently erase the first. On a normal day that
// never happens; on a wedding night, with two or three door staff scanning
// guests in at once, it happens exactly when it hurts most (a guest gets
// admitted but their check-in disappears). Every write therefore goes through
// withDb(), which does a compare-and-set against a version counter and simply
// retries against fresh data when it loses a race — see withDb below.

import path from "path";
import fs from "fs";

const REDIS_KEY = "da3wa:db";
// Bumped on every successful write; a write only lands if the version it read
// is still the current one. Kept as its own key (rather than a field inside
// the document) so the check costs nothing — no parsing the whole document
// inside Redis just to compare one number.
const REDIS_VERSION_KEY = "da3wa:db:v";

// Not real multi-tenant auth yet (that's future roadmap work) — but every
// wedding is its own "event" record from day one, identified by the
// groom/couple's own phone number, with its own guest list and its own
// invite-count package limit. The admin dashboard (single password, run by
// the platform owner) manages all events.
const DEFAULT_DB = {
  events: [],
  guests: [],
  messages: [],
  // Every door-scan attempt (successful or rejected) gets logged here, along
  // with which scanner-staff member's session made it — the audit trail that
  // lets the admin/couple see who did what at the door if something looks
  // like misuse (e.g. someone repeatedly trying an already-used QR).
  checkinLogs: [],
};

// Vercel's Upstash-for-Redis marketplace integration prepends whatever custom
// prefix you choose to ITS OWN suffixes (e.g. "<prefix>_KV_REST_API_URL"),
// not a clean "<prefix>_URL". So we check the plain expected names first,
// then the exact names Vercel generates for this project, then fall back to
// scanning all env vars for anything that looks like a REST API URL/token —
// this keeps working even if the integration is ever reconnected with a
// different custom prefix.
function getUpstashUrl() {
  if (process.env.UPSTASH_REDIS_REST_URL) return process.env.UPSTASH_REDIS_REST_URL;
  if (process.env.UPSTASH_REDIS_REST_KV_REST_API_URL) return process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const found = Object.entries(process.env).find(
    ([k]) => /REST_API_URL$/.test(k) && !/READ_ONLY/.test(k)
  );
  return found ? found[1] : null;
}

function getUpstashToken() {
  if (process.env.UPSTASH_REDIS_REST_TOKEN) return process.env.UPSTASH_REDIS_REST_TOKEN;
  if (process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN) return process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
  const found = Object.entries(process.env).find(
    ([k]) => /REST_API_TOKEN$/.test(k) && !/READ_ONLY/.test(k)
  );
  return found ? found[1] : null;
}

function hasUpstash() {
  return Boolean(getUpstashUrl() && getUpstashToken());
}

let redisClientPromise = null;
async function getRedis() {
  if (!redisClientPromise) {
    const url = getUpstashUrl();
    const token = getUpstashToken();
    redisClientPromise = import("@upstash/redis").then(
      ({ Redis }) => new Redis({ url, token })
    );
  }
  return redisClientPromise;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function readLocalDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
      return structuredClone(DEFAULT_DB);
    }
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return { ...structuredClone(DEFAULT_DB), ...JSON.parse(raw) };
  } catch (err) {
    console.error("[db] failed to read local db.json, using defaults", err);
    return structuredClone(DEFAULT_DB);
  }
}

function writeLocalDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export async function getDb() {
  if (hasUpstash()) {
    const redis = await getRedis();
    const data = await redis.get(REDIS_KEY);
    if (!data) {
      await redis.set(REDIS_KEY, DEFAULT_DB);
      return structuredClone(DEFAULT_DB);
    }
    // @upstash/redis auto-deserializes JSON values.
    return { ...structuredClone(DEFAULT_DB), ...data };
  }
  return readLocalDb();
}

export async function saveDb(db) {
  if (hasUpstash()) {
    const redis = await getRedis();
    await redis.set(REDIS_KEY, db);
    // Any unconditional write invalidates whatever version other in-flight
    // requests are holding, so they retry instead of overwriting this.
    await redis.incr(REDIS_VERSION_KEY);
    return;
  }
  writeLocalDb(db);
}

export function isUsingRedis() {
  return hasUpstash();
}

// Reads the document together with the version it was at, so a later write
// can tell whether anyone else changed it in the meantime.
async function readVersioned() {
  const redis = await getRedis();
  const [data, version] = await Promise.all([
    redis.get(REDIS_KEY),
    redis.get(REDIS_VERSION_KEY),
  ]);
  if (!data) {
    return { db: structuredClone(DEFAULT_DB), version: String(version ?? 0) };
  }
  return {
    db: { ...structuredClone(DEFAULT_DB), ...data },
    version: String(version ?? 0),
  };
}

// Writes the document only if the version counter still matches what we read.
// Returns true if the write landed, false if someone else got there first.
//
// Both keys are set together inside one script so the document and its
// version can never drift apart, even if two writers land in the same
// millisecond.
const CAS_SCRIPT = `
local current = redis.call('GET', KEYS[2])
if current == false then current = '0' end
if current ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3])
return 1
`;

async function compareAndSet(db, expectedVersion) {
  const redis = await getRedis();
  const nextVersion = String(Number(expectedVersion) + 1);
  const result = await redis.eval(
    CAS_SCRIPT,
    [REDIS_KEY, REDIS_VERSION_KEY],
    [String(expectedVersion), JSON.stringify(db), nextVersion]
  );
  return Number(result) === 1;
}

// Serializes local-file writes within this process. Node interleaves at every
// await, so without this two overlapping requests could read the same file
// contents and one would overwrite the other — the same race we guard against
// in Redis, just with a much simpler fix since there's only one process.
let localWriteQueue = Promise.resolve();

const MAX_ATTEMPTS = 8;

/**
 * Runs a read-modify-write cycle safely.
 *
 * The mutator receives the current database, changes it in place, and returns
 * whatever the caller needs back. It MUST be safe to run more than once: if
 * another request writes first, the mutator is re-run against freshly read
 * data and its earlier result is discarded. So keep side effects that must
 * happen exactly once (sending a WhatsApp message, charging something) OUTSIDE
 * the mutator — do the write here, then perform the side effect, then record
 * its outcome in a second withDb call.
 *
 * @template T
 * @param {(db: object) => T | Promise<T>} mutator
 * @returns {Promise<T>}
 */
export async function withDb(mutator) {
  if (!hasUpstash()) {
    const run = localWriteQueue.then(async () => {
      const db = readLocalDb();
      const result = await mutator(db);
      writeLocalDb(db);
      return result;
    });
    // Keep the queue alive even if this caller's mutator throws.
    localWriteQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { db, version } = await readVersioned();
    const result = await mutator(db);
    if (await compareAndSet(db, version)) return result;

    // Someone else wrote while we were working. Back off briefly — with a
    // little randomness so simultaneous losers don't retry in lockstep — and
    // try again from fresh data.
    const backoffMs = 15 * (attempt + 1) + Math.floor(Math.random() * 25);
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }

  throw new Error(
    `[db] gave up after ${MAX_ATTEMPTS} attempts — too many concurrent writes`
  );
}

// Unified data layer.
//
// In production (Vercel), set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// (free tier on Vercel Marketplace) and the whole app state is stored as a
// single JSON document in Redis under REDIS_KEY.
//
// In local dev, with no Upstash env vars set, we fall back to a JSON file on
// disk (data/db.json) via lowdb. This is NOT persistent on serverless
// platforms between invocations — it's only meant for `npm run dev`.

import path from "path";
import fs from "fs";

const REDIS_KEY = "da3wa:db";

// Not real multi-tenant auth yet (that's future roadmap work) — but every
// wedding is its own "event" record from day one, identified by the
// groom/couple's own phone number, with its own guest list and its own
// invite-count package limit. The admin dashboard (single password, run by
// the platform owner) manages all events.
const DEFAULT_DB = {
  events: [],
  guests: [],
  messages: [],
};

function hasUpstash() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

let redisClientPromise = null;
async function getRedis() {
  if (!redisClientPromise) {
    redisClientPromise = import("@upstash/redis").then(
      ({ Redis }) => new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
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
    return;
  }
  writeLocalDb(db);
}

export function isUsingRedis() {
  return hasUpstash();
}

// Small helper to run a read-modify-write cycle. Not a real transaction
// (Upstash REST API has no optimistic locking here), but good enough for
// this app's traffic volume.
export async function withDb(mutator) {
  const db = await getDb();
  const result = await mutator(db);
  await saveDb(db);
  return result;
}

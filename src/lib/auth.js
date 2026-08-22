import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "da3wa_admin";

function getSecret() {
  return process.env.APP_SECRET || "insecure-dev-fallback-secret";
}

function makeSessionValue() {
  return crypto
    .createHmac("sha256", getSecret())
    .update("admin-session")
    .digest("hex");
}

export async function createAdminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, makeSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAdminAuthed() {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  return Boolean(value) && value === makeSessionValue();
}

export function checkAdminPassword(password) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    console.warn("[auth] ADMIN_PASSWORD is not set — admin login will always fail.");
    return false;
  }
  return password === expected;
}

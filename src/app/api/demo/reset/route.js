import { NextResponse } from "next/server";
import { resetDemo } from "@/lib/demo";

// Open on purpose. It is a button on a tablet at a trade stand, pressed by
// whoever is standing there, and the only thing it can touch is a wedding
// made of four invented people.
export const dynamic = "force-dynamic";

export async function POST() {
  await resetDemo();
  return NextResponse.json({ ok: true });
}

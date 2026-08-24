import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { watiIsConfigured, listAccountTemplates } from "@/lib/wati";

// Admin-only: reports what this deployment is actually configured with, and
// checks each configured template against the live Wati account.
//
// Written after a failed first send took several rounds to diagnose. The
// deployment held a template name that Meta had not approved, and the only
// symptom was a raw "Wati API error 400" per guest. Nothing in the product
// could answer "what template is this deployment even using?" — the answer
// lived in the Vercel dashboard, which meant guessing from the outside. Now
// the dashboard shows it.
//
// Only names and statuses are returned, never tokens or the endpoint URL.
export const dynamic = "force-dynamic";

const TEMPLATE_SETTINGS = [
  { env: "WATI_INVITE_TEMPLATE_NAME", label: "قالب الدعوة", required: true },
  { env: "WATI_QR_TEMPLATE_NAME", label: "قالب رمز الدخول", required: true },
  { env: "WATI_REMINDER_TEMPLATE_NAME", label: "قالب التذكير", required: false },
];

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const configured = watiIsConfigured();
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");

  let account = null;
  let accountError = null;
  if (configured) {
    try {
      account = await listAccountTemplates();
    } catch (err) {
      accountError = err.message;
    }
  }

  const templates = TEMPLATE_SETTINGS.map(({ env, label, required }) => {
    const name = process.env[env] || "";
    const entry = {
      env,
      label,
      required,
      // Shown verbatim so a stray space or a wrong name is visible rather
      // than inferred — that was the actual bug.
      value: name,
      status: null,
      ok: false,
      problem: null,
    };

    if (!name) {
      entry.problem = required ? "غير مضبوط" : "غير مضبوط (اختياري)";
      return entry;
    }
    if (name.trim() !== name) {
      entry.problem = "فيه مسافة زائدة قبل أو بعد الاسم";
      return entry;
    }
    if (!account) {
      entry.problem = accountError ? "تعذّر الاتصال بـ Wati للتحقق" : null;
      return entry;
    }

    const found = account.get(name);
    if (!found) {
      entry.problem = "غير موجود في حساب Wati";
      return entry;
    }
    entry.status = found.status;
    if (found.status !== "APPROVED") {
      entry.problem = `حالته ${found.status} — واتساب لا يرسل إلا المعتمد`;
      return entry;
    }
    entry.ok = true;
    entry.params = found.paramNames;
    return entry;
  });

  const baseProblem = !baseUrl
    ? "غير مضبوط"
    : /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(baseUrl)
      ? "يشير إلى جهاز محلي — روابط الدعوات لن تعمل"
      : null;

  return NextResponse.json({
    watiConfigured: configured,
    accountError,
    baseUrl: { value: baseUrl, problem: baseProblem, ok: Boolean(baseUrl) && !baseProblem },
    // A wrong value here breaks every send on multi-number accounts, and it's
    // easy to forget it's even set.
    channelNumber: process.env.WATI_CHANNEL_NUMBER || "",
    templates,
    approvedTemplates: account
      ? [...account.entries()]
          .filter(([, t]) => t.status === "APPROVED")
          .map(([name, t]) => ({ name, params: t.paramNames }))
      : [],
  });
}

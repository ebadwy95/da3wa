import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import {
  messagingIsConfigured,
  messagingProvider,
  listAccountTemplates,
  templateEnvFor,
} from "@/lib/messaging";

// Admin-only: reports what this deployment is actually configured with, and
// checks each configured template against the live WhatsApp account.
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
  { kind: "INVITE", label: "قالب الدعوة", required: true },
  { kind: "QR", label: "قالب رمز الدخول", required: true },
  { kind: "REMINDER", label: "قالب التذكير", required: false },
];

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const configured = messagingIsConfigured();
  const provider = messagingProvider();
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

  const templates = TEMPLATE_SETTINGS.map(({ kind, label, required }) => {
    const env = templateEnvFor(kind);
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
      entry.problem = accountError ? "تعذّر الاتصال بحساب واتساب للتحقق" : null;
      return entry;
    }

    const found = account.get(name);
    if (!found) {
      entry.problem = "غير موجود في حساب واتساب";
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
    // "cloud", "360dialog", "zoko" or "wati" — which one is actually being
    // used, since several sets of variables can be present at once.
    provider,
    accountError,
    baseUrl: { value: baseUrl, problem: baseProblem, ok: Boolean(baseUrl) && !baseProblem },
    // A wrong value here breaks every send on multi-number accounts, and it's
    // easy to forget it's even set.
    channelNumber: provider === "wati" ? process.env.WATI_CHANNEL_NUMBER || "" : "",
    templates,
    approvedTemplates: account
      ? [...account.entries()]
          .filter(([, t]) => t.status === "APPROVED")
          .map(([name, t]) => ({ name, params: t.paramNames }))
      : [],
  });
}

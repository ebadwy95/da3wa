import nodemailer from "nodemailer";

// Outgoing mail for enquiries from the public form.
//
// Configured the same way everything else in this app is: if the credentials
// aren't set, sending resolves to a "simulated" result rather than throwing.
// The enquiry itself is always written to the database first, so an unsent
// notification means someone has to open the dashboard — never that a lead was
// lost.

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

export function mailIsConfigured() {
  return isConfigured();
}

let transporter = null;
function getTransporter() {
  if (!transporter) {
    const port = parseInt(process.env.SMTP_PORT || "465", 10);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // 465 is implicit TLS; 587 upgrades with STARTTLS.
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  return transporter;
}

/**
 * Sends one plain-text notification. Returns { simulated } or { error } rather
 * than throwing — the caller has already stored the thing being notified about.
 */
export async function sendMail({ to, subject, text, replyTo }) {
  if (!isConfigured()) {
    return { simulated: true, reason: "SMTP_HOST / SMTP_USER / SMTP_PASSWORD not configured" };
  }
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      // So replying in the mail client goes to the person who enquired.
      replyTo,
    });
    return { simulated: false };
  } catch (err) {
    return { simulated: false, error: err.message };
  }
}

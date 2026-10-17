// The sign-in e-mail, on the shared product template (brand kit 13 §4, after the Lapisan Console's mailer) in AXLE's
// look: the dark bar with the orange AXLE tag, a heading, the words, what happens next, one orange button with when it
// stops working, the link written out in mono, and the footer lines. Tables and inline styles only, so Gmail, Outlook
// and Apple Mail draw it alike; light only. The text part says the same, link first.
import { AXLE_MAIL as C } from "./axle-colours";

export interface Mail { subject: string; text: string; html: string }

const SANS = "Poppins,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',Consolas,'Courier New',monospace";
const SUPPORT = "support@go.antarax.ai";
const CREDIT = "AXLE · Outcomes by AntaraX, from REKA.";
const LEGAL = "AntaraX, a product line of REKA Inisiatif Sdn Bhd.";

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** "2:45 pm MYT", as the brand kit writes a time in a sentence. */
export function timeMyt(at: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "numeric", minute: "2-digit", hour12: true }).format(at).replace(/\s?(am|pm)$/i, (m) => " " + m.trim().toLowerCase()) + " MYT";
}

export function signInMail(o: { to: string; name: string; link: string; expiresAt: Date; minutes: number; appUrl: string }): Mail {
  const subject = "Your sign-in link for AXLE · Outcomes";
  const heading = "Sign in to AXLE · Outcomes";
  const lines = [`Hello ${o.name},`, "Here is the link you asked for. It signs you in on the device you open it on."];
  const steps = ["Open the link and press Continue.", "Enter the six-digit code from your authenticator app. The first time, you set the app up."];
  const note = `The link works once, for ${o.minutes} minutes: until ${timeMyt(o.expiresAt)}.`;
  const host = o.appUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const why = `You're getting this because someone asked to sign in as ${o.to} at ${host}. If that wasn't you, ignore it: nobody can sign in without this link and your authenticator code.`;
  const help = `Need help? Email ${SUPPORT} and the team will reply.`;

  const text = [
    `Sign in to AXLE · Outcomes: ${o.link}`,
    note,
    ...lines,
    steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    `--\n${why}\n${help}\n${CREDIT}\n${LEGAL}`,
  ].join("\n\n");

  const para = (l: string) => `<p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:24px;color:${C.text}">${escape(l)}</p>`;
  const stepRows = steps.map((s, i) => `<tr>
<td width="24" valign="top" style="padding:0 12px 10px 0"><div style="width:24px;height:24px;border-radius:12px;background:${C.orangeTint};color:${C.orangeText};font-family:${MONO};font-size:12px;font-weight:600;line-height:24px;text-align:center">${i + 1}</div></td>
<td valign="top" style="padding:2px 0 10px;font-family:${SANS};font-size:14px;line-height:20px;color:${C.textStrong}">${escape(s)}</td>
</tr>`).join("\n");

  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escape(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&amp;family=JetBrains+Mono:wght@500&amp;display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(note)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="background:${C.bar};border-radius:16px 16px 0 0;padding:18px 32px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="padding-right:10px"><span style="display:inline-block;background:${C.orange};color:${C.onOrange};border-radius:999px;padding:3px 10px;font-family:${MONO};font-size:11px;font-weight:600;letter-spacing:0.16em">AXLE</span></td>
<td valign="middle" style="font-family:${SANS};font-size:16px;font-weight:600;color:${C.barInk}">Outcomes <span style="font-size:12px;font-weight:400;color:${C.barMuted}">by AntaraX</span></td>
</tr></table>
</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.cardLine};border-top:0;border-radius:0 0 16px 16px;padding:30px 32px 26px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding-bottom:14px"><h1 style="margin:0;font-family:${SANS};font-size:22px;line-height:30px;font-weight:600;color:${C.textStrong}">${escape(heading)}</h1></td></tr>
<tr><td>${lines.map(para).join("\n")}</td></tr>
<tr><td style="padding:6px 0 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.infoTint};border:1px solid ${C.infoLine};border-radius:12px"><tr><td style="padding:16px 18px 6px">
<p style="margin:0 0 12px;font-family:${MONO};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${C.textMuted}">What happens next</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0">${stepRows}</table>
</td></tr></table></td></tr>
<tr><td style="padding:4px 0 10px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="border-radius:10px;background:${C.orange}"><a href="${escape(o.link)}" style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:15px;font-weight:600;line-height:20px;color:${C.onOrange};text-decoration:none;border-radius:10px">Sign in to Outcomes</a></td>
</tr></table>
</td></tr>
<tr><td style="padding:0 0 22px;font-family:${SANS};font-size:13px;line-height:20px;color:${C.textMuted}">${escape(note).replace(/(\d+:\d\d) (am|pm) MYT/, "$1&nbsp;$2&nbsp;MYT")}</td></tr>
<tr><td style="border-top:1px solid ${C.cardLine};padding-top:18px;font-family:${SANS};font-size:12px;line-height:18px;color:${C.textMuted}">Button not working? Paste this into your browser:<br><a href="${escape(o.link)}" style="font-family:${MONO};font-size:12px;color:${C.link};word-break:break-all">${escape(o.link)}</a></td></tr>
</table>
</td></tr>
<tr><td style="padding:18px 8px 0;font-family:${SANS};font-size:12px;line-height:18px;color:${C.textMuted}">${escape(why)}<br><br>${escape(help).replace(SUPPORT, `<a href="mailto:${SUPPORT}" style="color:${C.textMuted}">${SUPPORT}</a>`)}<br>${escape(CREDIT)}<br>${escape(LEGAL)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject, text, html };
}

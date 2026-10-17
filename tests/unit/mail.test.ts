import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { AXLE_MAIL } from "@/lib/mail/axle-colours";
import { signInMail, timeMyt } from "@/lib/mail/sign-in-mail";

describe("the sign-in e-mail", () => {
  const mail = signInMail({ to: "nurul@reka.example", name: "Nurul <b>Aina</b>", link: "https://outcomes.example/sign-in/link?t=AbC123", expiresAt: new Date("2026-10-17T06:45:00Z"), minutes: 15, appUrl: "https://outcomes.example/" });

  it("puts the link first in the text part, and says when it stops working in MYT", () => {
    expect(mail.text.split("\n")[0]).toBe("Sign in to AXLE · Outcomes: https://outcomes.example/sign-in/link?t=AbC123");
    expect(mail.text).toContain("until 2:45 pm MYT");
    expect(timeMyt(new Date("2026-10-17T16:05:00Z"))).toBe("12:05 am MYT");
  });

  it("has one button and the link written out, escapes what a person typed, and carries the footer lines", () => {
    expect(mail.html.match(/href="https:\/\/outcomes\.example\/sign-in\/link\?t=AbC123"/g)).toHaveLength(2);
    expect(mail.html).toContain("Nurul &lt;b&gt;Aina&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Aina");
    for (const line of ["support@go.antarax.ai", "AXLE · Outcomes by AntaraX, from REKA.", "AntaraX, a product line of REKA Inisiatif Sdn Bhd.", "at outcomes.example."]) expect(mail.html).toContain(line);
    expect(mail.subject).toBe("Your sign-in link for AXLE · Outcomes");
  });

  it("takes its colours from the AXLE tokens, never a typed hex value", () => {
    const css = readFileSync("app/axle-tokens.css", "utf8");
    for (const [key, value] of Object.entries(AXLE_MAIL)) {
      const name = key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
      expect(css, `--axle-${name} (npm run mail:colours)`).toMatch(new RegExp(`--axle-${name}:\\s*${value.replace(/[().]/g, "\\$&")};`));
    }
    expect(readFileSync("lib/mail/sign-in-mail.ts", "utf8")).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
  });
});

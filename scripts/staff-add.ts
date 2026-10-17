// Add a staff member: npm run staff:add -- --email a@reka.example --name "Aisyah Rahman" --role approver
// The password is read from STAFF_PASSWORD (never a flag, so it stays out of shell history). Two-step is set up at first sign-in.
import { parseArgs } from "node:util";
import { addStaff } from "../lib/services/staff";
import { closeDb } from "../lib/db";
import { ROLES, type Role } from "../lib/auth/roles";

const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" }, role: { type: "string" } } });
const password = process.env.STAFF_PASSWORD ?? "";
if (!values.email || !values.name || !ROLES.includes(values.role as Role) || password.length < 12) {
  console.error("Usage: STAFF_PASSWORD=… npm run staff:add -- --email … --name … --role viewer|operator|approver (password at least 12 characters)");
  process.exit(1);
}
process.env.ALLOW_OWNER_CONNECTION ??= "0";
addStaff(values.email, values.name, values.role as Role, password)
  .then((id) => console.log(`Added ${values.name} (${values.role}), ${id}. They set up two-step at first sign-in.`))
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => closeDb());

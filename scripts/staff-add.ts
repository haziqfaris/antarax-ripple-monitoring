// Add a staff member: npm run staff:add -- --email a@reka.example --name "Aisyah Rahman" --role approver
// No password: they sign in with an e-mailed link and set up their two-step code the first time.
import { parseArgs } from "node:util";
import { addStaff } from "../lib/services/staff";
import { closeDb } from "../lib/db";
import { ROLES, type Role } from "../lib/auth/roles";

const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" }, role: { type: "string" } } });
if (!values.email?.includes("@") || !values.name || !ROLES.includes(values.role as Role)) {
  console.error("Usage: npm run staff:add -- --email … --name … --role viewer|operator|approver");
  process.exit(1);
}
process.env.ALLOW_OWNER_CONNECTION ??= "0";
addStaff(values.email, values.name, values.role as Role)
  .then((id) => console.log(`Added ${values.name} (${values.role}), ${id}. They sign in with an e-mailed link and set up two-step the first time.`))
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => closeDb());

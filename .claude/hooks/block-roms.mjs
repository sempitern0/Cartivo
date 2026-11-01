// PreToolUse (Bash): bloquea `git commit` si hay ROMs, BIOS, imágenes de disco o node_modules en el índice.
import { execSync } from "node:child_process";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
let command = "";
try {
  command = JSON.parse(raw)?.tool_input?.command ?? "";
} catch {
  process.exit(0);
}
if (!/\bgit\s+(-\S+\s+)*commit\b/.test(command)) process.exit(0);

const forbidden =
  /(\.(nes|fds|sfc|smc|gb|gbc|gba|sms|md|gen|smd|n64|z64|v64|cue|iso|chd|cso|pbp|bin|rom|sav|srm|state)$)|(^|\/)node_modules\//i;
let staged = [];
try {
  staged = execSync("git diff --cached --name-only", { encoding: "utf8" }).split("\n").filter(Boolean);
} catch {
  process.exit(0);
}
// Fixtures propias autorizadas viven en packages/fixtures (con hash y licencia).
const bad = staged.filter((f) => forbidden.test(f) && !f.startsWith("packages/fixtures/"));
if (bad.length) {
  console.error(
    `Bloqueado por AGENTS.md (sin ROMs/BIOS/binarios en git). Archivos en el índice:\n${bad.join("\n")}`
  );
  process.exit(2);
}

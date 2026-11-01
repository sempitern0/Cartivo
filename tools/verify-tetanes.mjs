// Checks that the committed TetaNES build matches its manifest (ADR-008).
// The build itself happens in CI (.github/workflows/core-tetanes.yml).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const crate = resolve(import.meta.dirname, "../cores/tetanes");
const manifest = JSON.parse(readFileSync(join(crate, "manifest.json"), "utf8"));
const present = readdirSync(join(crate, "dist")).map((f) => `dist/${f}`).sort();
const listed = manifest.files.map((f) => f.path).sort();
if (JSON.stringify(present) !== JSON.stringify(listed))
  throw Error(`dist/ no coincide con el manifiesto: ${present} vs ${listed}`);
for (const file of manifest.files) {
  const actual = createHash("sha256")
    .update(readFileSync(join(crate, file.path)))
    .digest("hex");
  if (actual !== file.sha256)
    throw Error(`${file.path}: hash ${actual} distinto del manifiesto`);
}
const sbom = JSON.parse(readFileSync(join(crate, "sbom.json"), "utf8"));
// Private-use policy (ADR-005): any identified free/open licence, as in
// cores/tetanes/deny.toml. Unknown or missing licences still fail.
const allowed =
  /^(MIT|Apache-2\.0|Apache-2\.0 WITH LLVM-exception|BSD-[23]-Clause|0BSD|ISC|Zlib|Unlicense|Unicode-3\.0|MPL-2\.0|L?GPL-[23]\.[01](-only|-or-later)?)$/;
for (const dep of sbom) {
  const ok = String(dep.license ?? "")
    .split(/\s+OR\s+|\s*\/\s*/)
    .some((part) => part.replace(/[()]/g, "").split(/\s+AND\s+/).every((l) => allowed.test(l.trim())));
  if (!ok) throw Error(`${dep.name} ${dep.version}: licencia no admitida (${dep.license})`);
}
console.log(
  `TetaNES ${manifest.upstream.version} verificado: ${manifest.files.length} archivos, ${sbom.length} dependencias con licencia libre identificada.`,
);

// Checks that the committed Genesis Plus GX build matches its manifest (ADR-014).
// The build itself happens in CI (.github/workflows/core-genesis-plus-gx.yml).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const crate = resolve(import.meta.dirname, "../cores/genesis-plus-gx");
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
// Private-use policy (ADR-005): any identified free/open or source-available
// licence, including the non-commercial ones of Genesis Plus GX and its
// bundled cores. Unknown or missing
// licences still fail.
const allowed =
  /^(MIT|Apache-2\.0|Apache-2\.0 WITH LLVM-exception|BSD-[23]-Clause|0BSD|ISC|Zlib|Unlicense|Unicode-3\.0|MPL-2\.0|NCSA|CC0-1\.0|LicenseRef-public-domain|LicenseRef-(GenesisPlusGX|Musashi|MAME-Z80|notaz-SVP|NukedOPLL)-noncommercial|L?GPL-[23]\.[01](-only|-or-later)?|LGPL-2\.1(-only|-or-later)?)$/;
for (const dep of sbom) {
  const ok = String(dep.license ?? "")
    .split(/\s+OR\s+|\s*\/\s*/)
    .some((part) => part.replace(/[()]/g, "").split(/\s+AND\s+/).every((l) => allowed.test(l.trim())));
  if (!ok) throw Error(`${dep.name} ${dep.version}: licencia no admitida (${dep.license})`);
}
console.log(
  `Genesis Plus GX ${manifest.upstream.commit.slice(0, 7)} verificado: ${manifest.files.length} archivos, ${sbom.length} dependencias con licencia identificada (libre o de código disponible).`,
);

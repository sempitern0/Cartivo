// Checks that each committed Emscripten core build (SameBoy, mGBA, Snes9x,
// Genesis Plus GX, PCSX-ReARMed, Mupen64Plus-Next, Play!) matches its manifest and
// SBOM, without compiling anything.
// Usage: node tools/verify-core.mjs <id>... (ids are folders in cores/).
// The builds themselves happen in CI on explicit request (core-<id>.yml).
// TetaNES keeps its own stricter check (tools/verify-tetanes.mjs, ADR-005).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// Private-use policy (ADR-005): any identified free/open or source-available
// licence, including the named non-commercial ones of the integrated cores.
// Unknown or missing licences still fail.
const allowed =
  /^(MIT|Apache-2\.0|Apache-2\.0 WITH LLVM-exception|BSD-[23]-Clause|0BSD|ISC|Zlib|Unlicense|Unicode-3\.0|Libpng|bzip2-1\.0\.6|MPL-2\.0|NCSA|CC0-1\.0|LicenseRef-public-domain|LicenseRef-(Snes9x|GenesisPlusGX|Musashi|MAME-Z80|notaz-SVP|NukedOPLL)-noncommercial|L?GPL-[23]\.[01](-only|-or-later)?)$/;

/** "MIT OR Apache-2.0", "(A AND B) / C": some alternative fully allowed. */
const licensed = (expression) =>
  String(expression ?? "")
    .split(/\s+OR\s+|\s*\/\s*/)
    .some((part) =>
      part
        .replace(/[()]/g, "")
        .split(/\s+AND\s+/)
        .every((l) => allowed.test(l.trim())),
    );

const sha256 = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

function verify(id) {
  const dir = resolve(import.meta.dirname, "../cores", id);
  const read = (file) => JSON.parse(readFileSync(join(dir, file), "utf8"));
  const manifest = read("manifest.json");
  const present = readdirSync(join(dir, "dist")).map((f) => `dist/${f}`).sort();
  const listed = manifest.files.map((f) => f.path).sort();
  if (JSON.stringify(present) !== JSON.stringify(listed))
    throw Error(`${id}: dist/ no coincide con el manifiesto: ${present} vs ${listed}`);
  for (const file of manifest.files) {
    const actual = sha256(join(dir, file.path));
    if (actual !== file.sha256)
      throw Error(`${id}: ${file.path}: hash ${actual} distinto del manifiesto`);
  }
  const sbom = read("sbom.json");
  for (const dep of sbom)
    if (!licensed(dep.license))
      throw Error(`${id}: ${dep.name} ${dep.version}: licencia no admitida (${dep.license})`);
  const { name, tag, commit } = manifest.upstream;
  console.log(
    `${name} ${tag ?? commit.slice(0, 7)} verificado: ${manifest.files.length} archivos, ${sbom.length} dependencias con licencia identificada.`,
  );
}

const ids = process.argv.slice(2);
if (!ids.length) throw Error("Uso: node tools/verify-core.mjs <id>...");
for (const id of ids) verify(id);

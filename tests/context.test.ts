// The agents' map: tools/context-areas.mjs is the only source. The table in
// docs/ai/CONTEXT.md is generated from it, and every pattern must still
// point at real files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  areas,
  filesOf,
  patternToRegExp,
  withTable,
} from "../tools/context-areas.mjs";

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

test("docs/ai/CONTEXT.md carries the generated areas table", () => {
  const doc = readFileSync("docs/ai/CONTEXT.md", "utf8");
  assert.equal(doc, withTable(doc), "run: pnpm context --write-doc");
});

test("every area pattern still matches a tracked file", () => {
  assert.equal(new Set(areas.map((a) => a.id)).size, areas.length);
  for (const area of areas)
    for (const pattern of [...area.start, ...area.context])
      assert.ok(
        filesOf({ ...area, start: [pattern], context: [] }, tracked).length,
        `${area.id}: ${pattern} matches nothing`,
      );
});

test("patterns: exact files, folders, * and {a,b}", () => {
  const match = (pattern: string, path: string) =>
    patternToRegExp(pattern).test(path);
  assert.ok(
    match("apps/web/src/{App,Player}.svelte", "apps/web/src/App.svelte"),
  );
  assert.ok(
    !match("apps/web/src/{App,Player}.svelte", "apps/web/src/Apps.svelte"),
  );
  assert.ok(match("packages/input/src/", "packages/input/src/capture.ts"));
  assert.ok(match("docs/adr/006-*.md", "docs/adr/006-input-probe.md"));
  assert.ok(!match("tools/verify-*.mjs", "tools/sub/verify-x.mjs"));
  assert.ok(match("playwright*.ts", "playwright.preview.config.ts"));
  assert.ok(!match("package.json", "packages.json"));
});

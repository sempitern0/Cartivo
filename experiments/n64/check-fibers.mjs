// Explicit local micro-build only. Never invoked by the normal CI.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = import.meta.dirname;
const out = resolve(root, ".build");
const emcc = process.env.EMCC || "emcc";
const version = execFileSync(emcc, ["--version"], { encoding: "utf8" }).split(
  "\n",
)[0];
if (!/\b6\.0\.12\b/.test(version))
  throw new Error(`Expected emcc 6.0.12; found ${version}`);
mkdirSync(out, { recursive: true });
const artifact = resolve(out, "fiber-smoke.cjs");
const flags = [
  "-O1",
  "-std=c11",
  "-Wall",
  "-Wextra",
  "-Werror",
  "-sASYNCIFY",
  "-sASSERTIONS=2",
  "-sSTACK_OVERFLOW_CHECK=2",
  "-sALLOW_MEMORY_GROWTH",
  "-sENVIRONMENT=node",
  "-sEXIT_RUNTIME=1",
];
execFileSync(
  emcc,
  [
    ...flags,
    resolve(root, "fibers/cooperative.c"),
    resolve(root, "fibers/smoke.c"),
    "-o",
    artifact,
  ],
  { stdio: "inherit" },
);
const result = execFileSync(process.execPath, [artifact], {
  encoding: "utf8",
  timeout: 30_000,
});
if (!result.includes("PASS:")) throw new Error("Fiber smoke did not complete");
writeFileSync(
  resolve(out, "fiber-evidence.json"),
  JSON.stringify(
    {
      version,
      flags,
      result: result.trim(),
      scope: "microprobe only; not an N64 build",
    },
    null,
    2,
  ) + "\n",
);
process.stdout.write(result);

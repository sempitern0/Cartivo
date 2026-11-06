// Filename-only navigation for agents: no source, ROM, generated glue or logs.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const areas = {
  load: /^(apps\/web\/src\/(emulator\.worker\.ts|game-source\.ts|Player\.svelte)|packages\/runtime\/src\/(prepare-rom|client|protocol)\.ts|packages\/storage\/src\/(library|sram|states)\.ts|tests\/(prepare-rom|library|client)\.test\.ts|tests\/e2e\/(library|faults)\.spec\.ts|docs\/adr\/012-)/,
  input:
    /^(packages\/input\/src\/|apps\/web\/src\/(pad-navigation|input-mode|game-capture)|tests\/(input|capture|ui-navigation)\.test|tests\/e2e\/(pad-navigation|controls-page)\.spec|docs\/adr\/006-)/,
  pwa: /^(tools\/pwa-plugin|apps\/web\/src\/(pwa|offline-cache)|tests\/pwa\.test|tests\/e2e\/(pwa|subpath)\.spec|docs\/adr\/001-)/,
  ci: /^(\.github\/(workflows\/ci\.yml|actions\/setup\/action\.yml)|playwright.*\.ts|package\.json|tools\/verify-[^/]+\.mjs)$/,
  media:
    /^(packages\/media\/src\/|apps\/web\/src\/(sound|audio|GameStage|GraphicsPanel|PerformanceDetails)|tests\/(frame-|display-|audio)|docs\/DESIGN\.md)/,
};
const area = process.argv[2];
if (!Object.hasOwn(areas, area)) {
  console.error(
    `Usage: node tools/context.mjs <${Object.keys(areas).join("|")}>`,
  );
  process.exitCode = 1;
} else {
  const paths = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8" },
  ).split("\0");
  const files = [...new Set(paths)]
    .filter((path) => areas[area].test(path))
    .sort();
  let characters = 0;
  console.log(
    `Area: ${area}. Open relevant ranges only; sizes are not a reading checklist.`,
  );
  for (const path of files) {
    const text = readFileSync(path, "utf8");
    characters += text.length;
    console.log(
      `${path}\t${text.split("\n").length - 1} lines\t${text.length} chars`,
    );
  }
  console.log(
    `${files.length} candidates; ${characters} source characters kept out of this output. Not a token estimate.`,
  );
}

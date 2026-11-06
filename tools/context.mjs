// Filename-only navigation for agents: no source, ROM, generated glue or logs.
// The areas live in tools/context-areas.mjs, the one map of the project.
//   pnpm context <area>        candidate files of an area, with their size
//   pnpm context --write-doc   regenerate the table in docs/ai/CONTEXT.md
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { areas, filesOf, withTable } from "./context-areas.mjs";

const DOC = "docs/ai/CONTEXT.md";
const arg = process.argv[2];

if (arg === "--write-doc") {
  writeFileSync(DOC, withTable(readFileSync(DOC, "utf8")));
  console.log(`${DOC}: areas table regenerated.`);
} else {
  const area = areas.find((a) => a.id === arg);
  if (!area) {
    console.error(
      `Usage: pnpm context <${areas.map((a) => a.id).join("|")}> | --write-doc`,
    );
    process.exitCode = 1;
  } else {
    const tracked = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { encoding: "utf8" },
    ).split("\0");
    const files = filesOf(area, [...new Set(tracked)].filter(Boolean));
    let characters = 0;
    console.log(
      `Area: ${area.id} (${area.title}). Open relevant ranges only; sizes are not a reading checklist.`,
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
}

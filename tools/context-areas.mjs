// The one map of Cartivo for agents: which files and tests belong to each
// area. `pnpm context <area>` lists them; `pnpm context --write-doc`
// regenerates the table in docs/ai/CONTEXT.md (tests/context.test.ts fails
// if the two drift). Patterns are repo-relative: an exact path, a folder
// ending in "/", or globs with *, ** and {a,b}.

/** @type {{ id: string, title: string, start: string[], context: string[] }[]} */
export const areas = [
  {
    id: "ui",
    title: "Pantalla inicial, navegación y estilo",
    start: ["apps/web/src/{App,Player}.svelte", "apps/web/src/theme.css"],
    context: ["tests/e2e/{ui,pad-navigation}.spec.ts", "docs/DESIGN.md"],
  },
  {
    id: "input",
    title: "Controles, teclado, mando, foco y modo consola",
    start: [
      "packages/input/src/",
      "apps/web/src/{ControlsPanel,PauseMenu,PadHints,InterfacePreference}.svelte",
      "apps/web/src/{game-capture,pad-navigation.svelte,input-mode.svelte}.ts",
    ],
    context: [
      "tests/{input,capture,ui-navigation}.test.ts",
      "tests/e2e/{input,controls-page,pad-navigation}.spec.ts",
      "docs/adr/006-*.md",
    ],
  },
  {
    id: "load",
    title: "Carga de ROM y discos: Worker, preparación y biblioteca",
    start: [
      "apps/web/src/{emulator.worker,game-source}.ts",
      "packages/runtime/src/{prepare-rom,client,protocol}.ts",
      "packages/adapters/src/disc.ts",
      "packages/storage/src/{library,sram,states,disc-identity}.ts",
    ],
    context: [
      "tests/{prepare-rom,library,client,disc,disc-identity}.test.ts",
      "tests/e2e/{library,faults}.spec.ts",
      "docs/adr/{012,015}-*.md",
    ],
  },
  {
    id: "runtime",
    title: "Protocolo, sesión y sistemas",
    start: [
      "packages/runtime/src/{protocol,client,systems}.ts",
      "apps/web/src/emulator.worker.ts",
    ],
    context: [
      "tests/{client,systems,core-conformance}.test.ts",
      "docs/adr/002-*.md",
    ],
  },
  {
    id: "cores",
    title: "ROM, adaptador o consola",
    start: [
      "packages/adapters/src/{contract,registry,wasm-host}.ts",
      "cores/AGENTS.md",
    ],
    context: [
      "docs/ADDING_A_SYSTEM.md",
      "docs/research/",
      "tests/{core-conformance,wasm-host}.test.ts",
      "tests/e2e/{nes,gb,gba,snes,sega,pal,ps1}.spec.ts",
    ],
  },
  {
    id: "storage",
    title: "SRAM, Partidas, biblioteca y perfiles",
    start: [
      "packages/storage/src/",
      "apps/web/src/{SavePanel,LibraryPage,RecentGames,ContinueCard,ProfilePicker}.svelte",
      "apps/web/src/profile.svelte.ts",
    ],
    context: [
      "tests/{storage,snapshots,library,state-file,background-commit,persistence,profiles}.test.ts",
      "tests/e2e/{saves,storage,library,integrity,faults,profiles}.spec.ts",
      "docs/adr/{003,009,012,016}-*.md",
    ],
  },
  {
    id: "media",
    title: "Gráficos, audio y ritmo",
    start: [
      "packages/media/src/",
      "apps/web/src/{GraphicsPanel,GameStage,PerformanceDetails}.svelte",
      "apps/web/src/{audio.worklet,sound.svelte}.ts",
    ],
    context: [
      "tests/{display-scaler,frame-pacer,frame-metrics}.test.ts",
      "tests/e2e/nes.spec.ts",
      "docs/DESIGN.md",
    ],
  },
  {
    id: "pwa",
    title: "PWA, caché y modo offline",
    start: [
      "tools/pwa-plugin.mjs",
      "apps/web/src/{pwa.svelte,offline-cache}.ts",
      "apps/web/vite.config.ts",
    ],
    context: [
      "tests/pwa.test.ts",
      "tests/e2e/{pwa,subpath}.spec.ts",
      "docs/compatibility/H1-C-PWA.md",
      "docs/adr/001-*.md",
    ],
  },
  {
    id: "ci",
    title: "CI y toolchains",
    start: [
      ".github/workflows/ci.yml",
      ".github/actions/setup/action.yml",
      "tools/verify-*.mjs",
    ],
    context: ["package.json", "playwright*.ts", "cores/AGENTS.md"],
  },
];

/** A pattern as a regular expression over repo-relative paths. */
export function patternToRegExp(pattern) {
  let source = "";
  let braces = 0;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      source += ".*";
      i++;
    } else if (c === "*") source += "[^/]*";
    else if (c === "{" && ++braces) source += "(?:";
    else if (c === "}" && braces) {
      braces--;
      source += ")";
    } else if (c === "," && braces) source += "|";
    else source += c.replace(/[.+?^$()|[\]\\]/g, "\\$&");
  }
  // A folder matches everything under it.
  return new RegExp(`^${source}${pattern.endsWith("/") ? "" : "$"}`);
}

/** Paths among `files` that match any of `patterns`, sorted. */
export function filesMatching(patterns, files) {
  const tests = patterns.map(patternToRegExp);
  return files.filter((path) => tests.some((re) => re.test(path))).sort();
}

/** Paths among `files` that belong to `area` (start and context). */
export const filesOf = (area, files) =>
  filesMatching([...area.start, ...area.context], files);

const code = (patterns) => patterns.map((p) => `\`${p}\``).join(", ");

/** The Markdown table for docs/ai/CONTEXT.md. */
export function areasTable() {
  return [
    "| Área (`pnpm context …`) | Trabajo | Empezar por | Pruebas y contexto a demanda |",
    "|---|---|---|---|",
    ...areas.map(
      (a) =>
        `| \`${a.id}\` | ${a.title} | ${code(a.start)} | ${code(a.context)} |`,
    ),
  ].join("\n");
}

export const TABLE_START = "<!-- areas:start (pnpm context --write-doc) -->";
export const TABLE_END = "<!-- areas:end -->";

/** `doc` with the generated table between the markers. */
export function withTable(doc) {
  const start = doc.indexOf(TABLE_START);
  const end = doc.indexOf(TABLE_END);
  if (start < 0 || end < start)
    throw Error("docs/ai/CONTEXT.md has no areas markers");
  return (
    doc.slice(0, start + TABLE_START.length) +
    "\n" +
    areasTable() +
    "\n" +
    doc.slice(end)
  );
}

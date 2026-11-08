// Systems Cartivo can run, as the UI sees them. No core code here: the
// Worker side resolves cores through packages/adapters/src/registry.ts.
// Adding a console: docs/ADDING_A_SYSTEM.md.
import type { Action } from "../../input/src/nes-input.ts";
import {
  GBA_VIDEO,
  GB_VIDEO,
  MD_VIDEO,
  N64_VIDEO,
  NES_VIDEO,
  PS1_VIDEO,
  SMS_VIDEO,
  SNES_VIDEO,
  type VideoDescriptor,
} from "../../media/src/display-scaler.ts";

export type CoreInfo = {
  /** Must match a module id in packages/adapters/src/registry.ts. */
  id: string;
  label: string;
  /** Snapshot format version; must match the registered module. */
  version: string;
  /** Paths relative to the app's base (public/licenses/…). */
  licenses: { name: string; href: string }[];
  /**
   * For consoles with a choice (Ajustes › Avanzado): what the core is for
   * and its trade-offs, from Cartivo's own records (ADR and compatibility
   * notes), never from claims this project has not checked.
   */
  advice?: { summary: string; pros: string[]; cons: string[] };
};

export type SystemInfo = {
  id: string;
  /** Short name used across the UI (cards, kicker, aria labels). */
  name: string;
  longName: string;
  /**
   * Lower-case file extensions including the dot. For a disc system, in the
   * order the core prefers to boot them (a .cue before its tracks).
   */
  extensions: string[];
  /** Games on CD, read on demand from the player's files (ADR-015). */
  disc?: true;
  /** A portable console (the home card's accent says so). */
  handheld?: true;
  /**
   * The core draws with WebGL2 on the game canvas, which the page hands to
   * the Worker at load (ADR-017); absent: the core returns RGBA frames.
   */
  surface?: "webgl2";
  /** The controller's main control is an analog stick (N64): a pad's left
   * stick drives it and is not mirrored on the D-pad. */
  analogStick?: true;
  /** Shown as experimental: playable, with the limits its sheet lists. */
  experimental?: true;
  video: VideoDescriptor;
  /** Frames per second the player advances (original hardware rate). */
  frameRate: number;
  /** Buttons of the original controller besides the D-pad, as Cartivo actions. */
  buttons: readonly Action[];
  /** The console's own names when they differ from Cartivo's (Mega Drive C on A). */
  labels?: Partial<Record<Action, string>>;
  cores: CoreInfo[];
  defaultCore: string;
  /** When to change core, shown above the choices in Ajustes › Avanzado. */
  coreAdvice?: string;
  /** Formats the current build accepts, in user terms. */
  formatNote: string;
  /** The registered cores ship an original demo ROM (hidden `#demo/<id>`). */
  demo: boolean;
  /** Only available systems get a card on the home screen. */
  available: boolean;
};

/** NES and Game Boy pads: A, B, Start and Select. */
const basicButtons: readonly Action[] = ["a", "b", "start", "select"];

export const systems: readonly SystemInfo[] = [
  {
    id: "nes",
    name: "NES",
    longName: "Nintendo Entertainment System",
    extensions: [".nes"],
    video: NES_VIDEO,
    // NTSC is 60.0988 Hz; kept at 60 as shipped (no audible drift yet).
    frameRate: 60,
    buttons: basicButtons,
    cores: [
      {
        id: "tetanes",
        label: "TetaNES · WebAssembly",
        version: "0.17.0",
        licenses: [
          {
            name: "Licencia TetaNES",
            href: "licenses/tetanes-LICENSE-MIT.txt",
          },
        ],
        // ADR-008, H0-WASM-NES.
        advice: {
          summary: "El núcleo por defecto y el más probado en Cartivo.",
          pros: [
            "Es el que recorren las pruebas automáticas en cada cambio.",
            "Respeta la memoria de los cartuchos originales UxROM y CNROM, que no tenían RAM extra.",
          ],
          cons: [
            "Necesita WebAssembly: si el navegador no lo carga, Cartivo lo dice y puedes elegir JSNES.",
            "En la única medición registrada (CI, sin navegador) gasta más CPU por fotograma que JSNES.",
          ],
        },
      },
      {
        id: "jsnes",
        label: "JSNES · JavaScript",
        version: "2.1.0",
        licenses: [
          { name: "Licencia JSNES", href: "licenses/jsnes-Apache-2.0.txt" },
        ],
        // ADR-007, H1-B-NES, H0-WASM-NES.
        advice: {
          summary:
            "Alternativa en JavaScript, para comparar o cuando TetaNES falla.",
          pros: [
            "Funciona aunque WebAssembly no esté disponible o no cargue.",
            "En esa misma medición gasta menos CPU por fotograma.",
          ],
          cons: [
            "Se prueba menos: la integración se comprueba sobre todo con TetaNES.",
            "En UxROM y CNROM ofrece RAM extra que el cartucho original no tenía.",
          ],
        },
      },
    ],
    defaultCore: "tetanes",
    coreAdvice:
      "Deja TetaNES salvo que un juego no arranque, se vea mal o vaya a tirones en tu equipo; entonces prueba JSNES. El guardado del cartucho (batería) sirve para los dos; las Partidas de las ranuras son de cada núcleo y no se cargan con el otro.",
    formatNote: "cartuchos iNES NTSC (mappers 0–4)",
    demo: true,
    available: true,
  },
  gameBoy({
    id: "gb",
    name: "Game Boy",
    longName: "Nintendo Game Boy",
    extensions: [".gb"],
  }),
  gameBoy({
    id: "gbc",
    name: "Game Boy Color",
    longName: "Nintendo Game Boy Color",
    extensions: [".gbc"],
  }),
  {
    id: "gba",
    name: "Game Boy Advance",
    longName: "Nintendo Game Boy Advance",
    extensions: [".gba"],
    handheld: true,
    video: GBA_VIDEO,
    // 16 777 216 Hz clock, 280 896 cycles per frame ≈ 59.73 fps.
    frameRate: 16777216 / 280896,
    buttons: [...basicButtons, "l", "r"],
    cores: [
      {
        id: "mgba",
        label: "mGBA · WebAssembly",
        version: "0.10.5",
        licenses: [
          { name: "Licencia mGBA", href: "licenses/mgba-MPL-2.0.txt" },
          {
            name: "Licencia blip_buf",
            href: "licenses/blip_buf-LGPL-2.1.txt",
          },
          { name: "Licencia inih", href: "licenses/inih-BSD-3-Clause.txt" },
        ],
      },
    ],
    defaultCore: "mgba",
    formatNote:
      "cartuchos de Game Boy Advance con guardado SRAM, Flash o EEPROM, con la BIOS integrada de mGBA",
    demo: true,
    available: true,
  },
  {
    id: "snes",
    name: "SNES",
    longName: "Super Nintendo Entertainment System",
    extensions: [".sfc", ".smc"],
    video: SNES_VIDEO,
    // NTSC: 21 477 272 Hz master clock, 357 366 cycles per frame ≈ 60.10 fps.
    frameRate: 21477272 / 357366,
    buttons: ["a", "b", "x", "y", "start", "select", "l", "r"],
    cores: [
      {
        id: "snes9x",
        label: "Snes9x · WebAssembly",
        version: "1.63",
        licenses: [
          { name: "Licencia Snes9x", href: "licenses/snes9x-LICENSE.txt" },
          {
            name: "Licencia snes_spc y snes_ntsc",
            href: "licenses/snes9x-LGPL-2.1.txt",
          },
        ],
      },
    ],
    defaultCore: "snes9x",
    formatNote:
      "cartuchos NTSC LoROM, HiROM y ExHiROM, incluidos chips como Super FX, SA-1 o DSP",
    demo: true,
    available: true,
  },
  sega({
    id: "sms",
    name: "Master System",
    longName: "Sega Master System",
    extensions: [".sms"],
    video: SMS_VIDEO,
    buttons: ["b", "a", "start"],
    labels: { b: "1", a: "2", start: "Pause" },
    formatNote: "cartuchos de Master System, con o sin mapper de Sega",
  }),
  sega({
    id: "md",
    name: "Mega Drive",
    longName: "Sega Mega Drive / Genesis",
    extensions: [".md", ".gen", ".bin"],
    video: MD_VIDEO,
    // Six-button pad by position: A/B/C on Y/B/A, X/Y/Z on L/X/R.
    buttons: ["y", "b", "a", "l", "x", "r", "start", "select"],
    labels: { y: "A", b: "B", a: "C", l: "X", x: "Y", r: "Z", select: "Mode" },
    formatNote:
      "cartuchos NTSC o multirregión, con mando de 3 o 6 botones y SVP (Virtua Racing)",
  }),
  {
    id: "ps1",
    name: "PlayStation",
    longName: "Sony PlayStation",
    extensions: [".cue", ".iso", ".exe", ".bin"],
    disc: true,
    video: PS1_VIDEO,
    // NTSC nominal; the core reports each game's rate (PAL 50 Hz).
    frameRate: 60,
    // Digital pad by position: Cross/Circle on B/A, Square/Triangle on Y/X.
    buttons: ["b", "a", "y", "x", "l", "r", "l2", "r2", "start", "select"],
    labels: {
      b: "Cruz",
      a: "Círculo",
      y: "Cuadrado",
      x: "Triángulo",
      l: "L1",
      r: "R1",
    },
    cores: [
      {
        id: "pcsx-rearmed",
        label: "PCSX-ReARMed · WebAssembly",
        version: "7b0e8f8",
        licenses: [
          {
            name: "GPL-2.0 (PCSX-ReARMed)",
            href: "licenses/pcsx-rearmed-COPYING.txt",
          },
        ],
      },
    ],
    defaultCore: "pcsx-rearmed",
    formatNote:
      "discos .cue con sus pistas .bin, imágenes .iso o .bin de una pista y ejecutables .exe, con la BIOS HLE del núcleo",
    demo: true,
    available: true,
  },
  {
    id: "n64",
    name: "N64",
    longName: "Nintendo 64",
    extensions: [".z64", ".n64", ".v64"],
    surface: "webgl2",
    analogStick: true,
    experimental: true,
    video: N64_VIDEO,
    // NTSC nominal; the core reports each game's rate (PAL 50 Hz).
    frameRate: 60,
    // Every button on its own RetroPad position (the core's alt-map): A/B
    // on B/Y, Z on L2, L on Select, R on R2 and the C buttons on X/A/L/R.
    // The right stick also presses the C buttons.
    buttons: ["b", "y", "l2", "select", "r2", "x", "a", "l", "r", "start"],
    labels: {
      b: "A",
      y: "B",
      l2: "Z",
      select: "L",
      r2: "R",
      x: "C↑",
      a: "C↓",
      l: "C←",
      r: "C→",
    },
    cores: [
      {
        id: "mupen64plus-next",
        label: "Mupen64Plus-Next · WebGL2",
        version: "15bada8",
        licenses: [
          {
            name: "GPL-2.0 (Mupen64Plus-Next y GLideN64)",
            href: "licenses/mupen64plus-next-LICENSE.txt",
          },
          {
            name: "Avisos de terceros (GLideN64, libpng, zlib…)",
            href: "licenses/mupen64plus-next-NOTICES.txt",
          },
        ],
      },
    ],
    defaultCore: "mupen64plus-next",
    formatNote:
      "cartuchos .z64, .n64 o .v64 con el mando analógico; experimental, necesita WebGL2",
    demo: true,
    available: true,
  },
];

/** Master System and Mega Drive share Genesis Plus GX. */
function sega(
  info: Pick<
    SystemInfo,
    | "id"
    | "name"
    | "longName"
    | "extensions"
    | "video"
    | "buttons"
    | "labels"
    | "formatNote"
  >,
): SystemInfo {
  return {
    ...info,
    // NTSC: 53 693 175 Hz / (3420 × 262) ≈ 59.92 fps (both consoles).
    frameRate: 53693175 / (3420 * 262),
    cores: [
      {
        id: "genesis-plus-gx",
        label: "Genesis Plus GX · WebAssembly",
        version: "a5834b3",
        licenses: [
          {
            name: "Licencia Genesis Plus GX (incluye Nuked OPN2, Tremor y minimp3)",
            href: "licenses/genesis-plus-gx-LICENSE.txt",
          },
          { name: "Licencia Musashi", href: "licenses/musashi-readme.txt" },
          {
            name: "LGPL-2.1 (blip_buf, Nuked OPN2, filtros NTSC)",
            href: "licenses/blip_buf-LGPL-2.1.txt",
          },
        ],
      },
    ],
    defaultCore: "genesis-plus-gx",
    demo: true,
    available: true,
  };
}

/** GB and GBC share SameBoy; the cartridge header picks the hardware. */
function gameBoy(
  info: Pick<SystemInfo, "id" | "name" | "longName" | "extensions">,
): SystemInfo {
  return {
    ...info,
    handheld: true,
    video: GB_VIDEO,
    frameRate: 4194304 / 70224,
    buttons: basicButtons,
    cores: [
      {
        id: "sameboy",
        label: "SameBoy · WebAssembly",
        version: "1.0.4",
        licenses: [
          { name: "Licencia SameBoy", href: "licenses/sameboy-LICENSE.txt" },
        ],
      },
    ],
    defaultCore: "sameboy",
    formatNote: "cartuchos sin mapper, MBC1, MBC2, MBC3 (con reloj) y MBC5",
    demo: true,
    available: true,
  };
}

export function system(id: string): SystemInfo | undefined {
  return systems.find((s) => s.id === id);
}

export function availableSystems(): SystemInfo[] {
  return systems.filter((s) => s.available);
}

/** A lone .bin up to this size is a Mega Drive cartridge, beyond it a CD
 * track (MAX_MD_ROM_BYTES in packages/adapters/src/sega-header.ts). */
const MAX_CARTRIDGE_BIN = 10 * 1024 * 1024;

export type GameFiles<F> = {
  system: SystemInfo;
  /** The file the core starts from. */
  file: F;
  /** A disc's other files (the tracks a .cue names); empty for cartridges. */
  extra: F[];
};

/**
 * The game among files opened together: a disc's boot file with the rest,
 * or a cartridge. Disc systems are tried first, so a .cue wins over its .bin
 * tracks; `preferred` (the card whose picker opened them) limits the choice.
 */
export function gameForFiles<F extends { name: string; size: number }>(
  files: readonly F[],
  preferred?: SystemInfo,
): GameFiles<F> | undefined {
  const candidates = preferred ? [preferred] : availableSystems();
  const ordered = [
    ...candidates.filter((s) => s.disc),
    ...candidates.filter((s) => !s.disc),
  ];
  /** A lone, cartridge-sized .bin goes to Mega Drive unless a card asked. */
  const cartridgeBin = (f: F) =>
    !preferred && files.length === 1 && f.size <= MAX_CARTRIDGE_BIN;
  for (const system of ordered)
    for (const extension of system.extensions) {
      const file = files.find(
        (f) =>
          f.name.toLowerCase().endsWith(extension) &&
          !(system.disc && extension === ".bin" && cartridgeBin(f)),
      );
      if (file)
        return {
          system,
          file,
          extra: system.disc ? files.filter((f) => f !== file) : [],
        };
    }
}

/** `accept` attribute for a file picker covering the given systems. */
export function acceptFor(list: readonly SystemInfo[]): string {
  return [...new Set(list.flatMap((s) => s.extensions))].join(",");
}

export function coreLabel(systemId: string, coreId: string): string {
  return (
    system(systemId)
      ?.cores.find((c) => c.id === coreId)
      ?.label.split(" · ")[0] ?? coreId
  );
}

/** The buttons of `order` used by at least one available system. */
export function controlButtons(order: readonly Action[]): Action[] {
  const used = new Set(availableSystems().flatMap((s) => s.buttons));
  return order.filter((action) => used.has(action));
}

/** «A, B y C»; «e» before a word that sounds /i/ («X e Y»). */
const listJoin = (items: string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} ${/^(y$|h?i)/i.test(items.at(-1)!) ? "e" : "y"} ${items.at(-1)}`;

/** Where a console with its own button names finds each one. */
export type ConsoleButtons = {
  name: string;
  pairs: { own: string; key: string }[];
};

/**
 * The button guide in Controles: consoles with their own button names and
 * where each one is (Cruz on B), then buttons that only a minority of
 * consoles use, grouped by those consoles («X e Y solo los usan SNES y Mega
 * Drive.»).
 */
export function buttonGuide(label: (action: Action) => string): {
  consoles: ConsoleButtons[];
  minority: string[];
} {
  const consoles = availableSystems();
  const groups = new Map<string, { users: number; buttons: Action[] }>();
  for (const action of new Set(consoles.flatMap((s) => s.buttons))) {
    const users = consoles.filter((s) => s.buttons.includes(action));
    if (users.length * 2 > consoles.length) continue;
    const names = listJoin(users.map((s) => s.name));
    const group = groups.get(names) ?? { users: users.length, buttons: [] };
    groups.set(names, { ...group, buttons: [...group.buttons, action] });
  }
  return {
    consoles: consoles.flatMap((s) => {
      const own = s.buttons.filter((a) => s.labels?.[a]);
      return own.length
        ? [
            {
              name: s.name,
              pairs: own.map((a) => ({ own: s.labels![a]!, key: label(a) })),
            },
          ]
        : [];
    }),
    minority: [...groups].map(
      ([names, { users, buttons }]) =>
        `${listJoin(buttons.map(label))} solo ${buttons.length > 1 ? "los" : "lo"} ${users > 1 ? "usan" : "usa"} ${names}.`,
    ),
  };
}

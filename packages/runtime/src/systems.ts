// Systems Cartivo can run, as the UI sees them. No core code here: the
// Worker side resolves cores through packages/adapters/src/registry.ts.
// Adding a console: docs/ADDING_A_SYSTEM.md.
import type { Action } from "../../input/src/nes-input.ts";
import {
  GBA_VIDEO,
  GB_VIDEO,
  NES_VIDEO,
  SNES_VIDEO,
  type VideoDescriptor,
} from "../../media/src/display-scaler.ts";

export type CoreInfo = {
  /** Must match a module id in packages/adapters/src/registry.ts. */
  id: string;
  label: string;
  /** Snapshot format version; must match the registered module. */
  version: string;
  licenses: { name: string; href: string }[];
};

export type SystemInfo = {
  id: string;
  /** Short name used across the UI (cards, kicker, aria labels). */
  name: string;
  longName: string;
  /** Lower-case file extensions including the dot. */
  extensions: string[];
  video: VideoDescriptor;
  /** Frames per second the player advances (original hardware rate). */
  frameRate: number;
  /** Buttons of the original controller besides the D-pad, as Cartivo actions. */
  buttons: readonly Action[];
  cores: CoreInfo[];
  defaultCore: string;
  /** Formats the current build accepts, in user terms. */
  formatNote: string;
  /** The registered cores ship an original demo ROM («Probar demo»). */
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
            href: "/licenses/tetanes-LICENSE-MIT.txt",
          },
        ],
      },
      {
        id: "jsnes",
        label: "JSNES · JavaScript",
        version: "2.1.0",
        licenses: [
          { name: "Licencia JSNES", href: "/licenses/jsnes-Apache-2.0.txt" },
        ],
      },
    ],
    defaultCore: "tetanes",
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
          { name: "Licencia mGBA", href: "/licenses/mgba-MPL-2.0.txt" },
          {
            name: "Licencia blip_buf",
            href: "/licenses/blip_buf-LGPL-2.1.txt",
          },
          { name: "Licencia inih", href: "/licenses/inih-BSD-3-Clause.txt" },
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
          { name: "Licencia Snes9x", href: "/licenses/snes9x-LICENSE.txt" },
          {
            name: "Licencia snes_spc y snes_ntsc",
            href: "/licenses/snes9x-LGPL-2.1.txt",
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
];

/** GB and GBC share SameBoy; the cartridge header picks the hardware. */
function gameBoy(
  info: Pick<SystemInfo, "id" | "name" | "longName" | "extensions">,
): SystemInfo {
  return {
    ...info,
    video: GB_VIDEO,
    frameRate: 4194304 / 70224,
    buttons: basicButtons,
    cores: [
      {
        id: "sameboy",
        label: "SameBoy · WebAssembly",
        version: "1.0.4",
        licenses: [
          { name: "Licencia SameBoy", href: "/licenses/sameboy-LICENSE.txt" },
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

/** System for a file name by extension (case-insensitive), if any. */
export function systemForFile(name: string): SystemInfo | undefined {
  const lower = name.toLowerCase();
  return availableSystems().find((s) =>
    s.extensions.some((ext) => lower.endsWith(ext)),
  );
}

/** `accept` attribute for a file picker covering the given systems. */
export function acceptFor(list: readonly SystemInfo[]): string {
  return list.flatMap((s) => s.extensions).join(",");
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

/**
 * Notes for buttons that only some consoles use, grouped by those consoles,
 * e.g. «L y R solo los usa Game Boy Advance.».
 */
export function buttonNotes(label: (action: Action) => string): string[] {
  const consoles = availableSystems();
  const groups = new Map<string, Action[]>();
  for (const action of new Set(consoles.flatMap((s) => s.buttons))) {
    const users = consoles.filter((s) => s.buttons.includes(action));
    if (users.length === consoles.length) continue;
    const names = listJoin(users.map((s) => s.name));
    groups.set(names, [...(groups.get(names) ?? []), action]);
  }
  return [...groups].map(
    ([names, buttons]) =>
      `${listJoin(buttons.map(label))} solo ${names.includes(" y ") ? "los usan" : "los usa"} ${names}.`,
  );
}

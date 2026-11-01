// Systems Cartivo can run, as the UI sees them. No core code here: the
// Worker side resolves cores through packages/adapters/src/registry.ts.
// Adding a console: docs/ADDING_A_SYSTEM.md.
import {
  GB_VIDEO,
  NES_VIDEO,
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
  cores: CoreInfo[];
  defaultCore: string;
  /** Formats the current build accepts, in user terms. */
  formatNote: string;
  /** The registered cores ship an original demo ROM («Probar demo»). */
  demo: boolean;
  /** Only available systems get a card on the home screen. */
  available: boolean;
};

export const systems: readonly SystemInfo[] = [
  {
    id: "nes",
    name: "NES",
    longName: "Nintendo Entertainment System",
    extensions: [".nes"],
    video: NES_VIDEO,
    // NTSC is 60.0988 Hz; kept at 60 as shipped (no audible drift yet).
    frameRate: 60,
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
];

/** GB and GBC share SameBoy; the cartridge header picks the hardware. */
function gameBoy(
  info: Pick<SystemInfo, "id" | "name" | "longName" | "extensions">,
): SystemInfo {
  return {
    ...info,
    video: GB_VIDEO,
    frameRate: 4194304 / 70224,
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

import type { LibraryEntry } from "../../../packages/storage/src/library.ts";
import type { StateMeta } from "../../../packages/storage/src/states.ts";
import type { SystemInfo } from "../../../packages/runtime/src/systems.ts";
export type GameCard = LibraryEntry & {
  resume?: StateMeta;
  stateUnavailable?: boolean;
};
export function chooseResume(
  states: readonly StateMeta[],
  system: SystemInfo,
): StateMeta | undefined {
  const supported = states.filter((state) =>
    system.cores.some(
      (core) => core.id === state.core && core.version === state.coreVersion,
    ),
  );
  return (
    supported.find((state) => state.slot === "auto") ??
    [...supported].sort((a, b) => b.createdAt - a.createdAt)[0]
  );
}
export const playLabel = (game: GameCard) =>
  game.resume
    ? game.resume.slot === "auto"
      ? "Continuar"
      : "Cargar partida"
    : "Jugar";

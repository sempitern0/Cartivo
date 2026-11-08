// «Borrar mi progreso» (ADR-018): one profile's Partidas and battery RAM for
// one game. The title, its copy and other profiles' progress stay. Takes the
// same per-game locks as a running session, so a game open in another tab is
// refused instead of being erased under it.
import { sramKey } from "./formats.ts";
import { PRINCIPAL } from "./profiles.ts";
import { SramStore } from "./sram.ts";
import { StateStore, stateSlots } from "./states.ts";

export async function eraseProgress(
  system: string,
  hash: string,
  profile = PRINCIPAL,
) {
  const states = await StateStore.open(hash, profile);
  try {
    for (const slot of stateSlots) await states.delete(slot);
    const sram = await SramStore.open(
      sramKey(system, hash),
      undefined,
      profile,
    );
    try {
      await sram.erase();
    } finally {
      sram.close();
    }
  } finally {
    states.close();
  }
}

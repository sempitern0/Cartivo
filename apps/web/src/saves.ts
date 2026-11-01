// UI vocabulary for «Partidas» slots (ADR-009), shared by the save panel,
// the continue offer and notifications.
import type { StateSlot } from "../../../packages/storage/src/states.ts";

export const allSlots: StateSlot[] = ["auto", "1", "2", "3"];

export const slotNames: Record<StateSlot, string> = {
  auto: "Al salir",
  "1": "Ranura 1",
  "2": "Ranura 2",
  "3": "Ranura 3",
};

const dateFormat = new Intl.DateTimeFormat("es", {
  dateStyle: "short",
  timeStyle: "short",
});

export const when = (time: number) => dateFormat.format(time);

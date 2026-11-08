// Turns for E2E tests across Playwright workers (fixtures.ts).
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Heavy tests (N64 drawing with WebGL2 in software, PS1 discs, the 100
 * cycles) run alone: on a CI runner, anything emulating beside them slows
 * them until the player pauses itself («no consigue mantener la velocidad»).
 * A file uses `test.use({ heavy: true })`, a single test the tag `@heavy`.
 *
 * A readers-writer lock across workers, on the file system: a heavy test
 * takes the writer directory (mkdir is atomic) and waits until no other test
 * runs; any other test waits while a heavy one holds it, registers itself,
 * and checks again so a heavy test that just arrived goes first. After two
 * minutes of waiting a lock counts as left by a crashed worker.
 */
const ROOT =
  process.env.CARTIVO_TURNS_DIR ?? join(tmpdir(), "cartivo-e2e-turns");
const WRITER = join(ROOT, "heavy");
const READERS = join(ROOT, "readers");
const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

export async function takeTurn(
  heavy: boolean,
  id: string,
): Promise<() => Promise<void>> {
  await mkdir(READERS, { recursive: true });
  const until = Date.now() + 120_000;
  if (heavy) {
    while (Date.now() < until) {
      try {
        await mkdir(WRITER);
        break;
      } catch {
        await pause();
      }
    }
    while (Date.now() < until && (await readdir(READERS)).length) await pause();
    return () => rm(WRITER, { recursive: true, force: true });
  }
  const mine = join(READERS, id);
  for (;;) {
    while (Date.now() < until && (await exists(WRITER))) await pause();
    await writeFile(mine, "");
    if (Date.now() >= until || !(await exists(WRITER))) break;
    await rm(mine, { force: true });
  }
  return () => rm(mine, { force: true });
}

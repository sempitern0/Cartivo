import { test, expect, type Page } from "./fixtures.ts";

// Local library and «Continuar» (ADR-012) with Cartivo's own NES fixture.
const NAME = "mi-juego.nes";

// Playwright's WebKit runs every test in an ephemeral profile where OPFS is
// unavailable (navigator.storage.getDirectory() fails), like a Safari private
// window. Cartivo then keeps playing and explains it cannot remember the game;
// the library itself needs a normal Safari profile (manual QA, H1-QA).
test.skip(
  ({ browserName }) => browserName === "webkit",
  "OPFS is unavailable in Playwright's ephemeral WebKit profile.",
);

/**
 * The fixture under another name; `variant` flips the last CHR byte (one
 * pixel of a tile), so each variant is a different game for the library.
 */
async function game(name = NAME, variant = 0) {
  const { controlDemo } =
    await import("../../packages/fixtures/src/control-demo.ts");
  const rom = controlDemo();
  rom[rom.length - 1] ^= variant;
  return {
    name,
    mimeType: "application/octet-stream",
    buffer: Buffer.from(rom),
  };
}

async function open(page: Page, name = NAME, variant = 0) {
  await page
    .locator("input[type=file]")
    .setInputFiles(await game(name, variant));
}

async function running(page: Page) {
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-frames")),
    )
    .toBeGreaterThan(10);
}

const exit = (page: Page) =>
  page.getByRole("button", { name: "Salir", exact: true }).click();
const continueCard = (page: Page) =>
  page.getByRole("article", { name: NAME, exact: true });
const library = (page: Page) =>
  page.getByRole("region", { name: "Tus juegos" });
const games = (page: Page) =>
  page.getByRole("link", { name: "Tus juegos", exact: true }).click();

/** «Opciones» → «Eliminar del dispositivo» → confirm (every profile). */
async function deleteFromDevice(page: Page, name: string) {
  await library(page)
    .getByRole("button", { name: `Opciones de ${name}` })
    .click();
  await library(page)
    .getByRole("button", { name: "Eliminar del dispositivo" })
    .click();
  await library(page)
    .getByRole("button", { name: `Eliminar ${name}`, exact: true })
    .click();
  await expect(library(page).getByRole("status")).toContainText(
    "Las partidas se conservan",
  );
}

/** Opens a game and leaves: it is remembered without asking. */
async function playAndLeave(page: Page, name = NAME, variant = 0) {
  await open(page, name, variant);
  await running(page);
  await exit(page);
  await expect(
    page
      .getByRole("article", { name, exact: true })
      .or(page.getByRole("button", { name: `Continuar ${name}` })),
  ).toBeVisible();
}

test("a remembered game continues from the home screen with one click", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await playAndLeave(page);
  await expect(continueCard(page)).toContainText("NES");

  await page.reload();
  let chooser = false;
  page.on("filechooser", () => (chooser = true));
  await continueCard(page).getByRole("button", { name: "Continuar" }).click();
  // Straight to the exit snapshot: no picker, no offer, no question.
  await expect(page.getByTestId("toast")).toContainText(
    "Partida cargada: al salir",
  );
  await running(page);
  await expect(page.getByRole("heading", { name: NAME })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Empezar de nuevo" }),
  ).toHaveCount(0);
  expect(chooser).toBe(false);
  expect(errors).toEqual([]);
});

test("the home shows the last three; «Tus juegos» searches and filters", async ({
  page,
}) => {
  await page.goto("/");
  for (const [i, name] of [
    "alfa.nes",
    "beta.nes",
    "gamma.nes",
    "delta.nes",
  ].entries())
    await playAndLeave(page, name, i + 1);
  // Most recent first: delta (large card), gamma and beta; alfa only on the page.
  await expect(
    page.getByRole("article", { name: "delta.nes", exact: true }),
  ).toBeVisible();
  const recent = page.getByRole("region", { name: "Juegos recientes" });
  await expect(recent.getByRole("button", { name: /^Continuar / })).toHaveCount(
    2,
  );
  await expect(
    recent.getByRole("button", { name: "Continuar alfa.nes" }),
  ).toHaveCount(0);
  await recent.getByRole("link", { name: "Ver todos tus juegos (4)" }).click();

  await expect(
    page.getByRole("heading", { name: "Tus juegos", level: 1 }),
  ).toBeFocused();
  await expect(library(page).getByRole("listitem")).toHaveCount(4);
  await library(page)
    .getByRole("searchbox", { name: "Buscar por nombre" })
    .fill("ALFA");
  await expect(library(page).getByRole("listitem")).toHaveCount(1);
  await library(page).getByRole("searchbox").fill("zzz");
  await expect(library(page).getByRole("status")).toHaveText(
    "Ningún juego coincide.",
  );
  await library(page).getByRole("searchbox").fill("");
  // One console only: no console chips to choose from.
  await expect(
    library(page).getByRole("group", { name: "Consola" }),
  ).toHaveCount(0);
  await library(page).getByRole("combobox").selectOption("name");
  await expect(library(page).getByRole("listitem").first()).toContainText(
    "alfa.nes",
  );

  await library(page)
    .getByRole("button", { name: "Continuar alfa.nes" })
    .click();
  await running(page);
  await expect(page.getByRole("heading", { name: "alfa.nes" })).toBeVisible();
});

test("turning remembering off keeps new games out of the list", async ({
  page,
}) => {
  await page.goto("/");
  await playAndLeave(page);
  await games(page);
  await library(page)
    .getByRole("checkbox", { name: /Recordar juegos nuevos/ })
    .uncheck();
  await expect(library(page).getByRole("status")).toContainText(
    "no se recordarán",
  );
  await page.getByRole("link", { name: "Volver al inicio" }).click();
  await open(page, "otro.nes", 7);
  await running(page);
  await exit(page);
  await expect(
    page.getByRole("button", { name: "Continuar otro.nes" }),
  ).toHaveCount(0);
  await expect(page.getByRole("article", { name: "otro.nes" })).toHaveCount(0);
  await games(page);
  await expect(library(page).getByRole("listitem")).toHaveCount(1);
  await expect(
    library(page).getByRole("checkbox", { name: /Recordar juegos nuevos/ }),
  ).not.toBeChecked();
});

test("deleting a game from the device keeps its Partidas", async ({ page }) => {
  await page.goto("/");
  await playAndLeave(page);
  await games(page);
  await deleteFromDevice(page, NAME);
  await page.getByRole("link", { name: "Volver al inicio" }).click();
  await expect(continueCard(page)).toHaveCount(0);
  // Reopening the file still finds the exit snapshot.
  await open(page);
  await expect(
    page.getByRole("dialog", { name: "Continuar donde lo dejaste" }),
  ).toBeVisible();
});

test("«Borrar mi progreso» erases this profile's Partidas; hiding is reversible", async ({
  page,
}) => {
  await page.goto("/");
  await playAndLeave(page);
  await games(page);
  const play = library(page).locator("li.card button.primary");
  await expect(play).toHaveText("Continuar");
  await library(page)
    .getByRole("button", { name: `Opciones de ${NAME}` })
    .click();
  await library(page)
    .getByRole("button", { name: "Borrar mi progreso" })
    .click();
  const confirm = library(page).getByRole("button", {
    name: `Borrar mi progreso en ${NAME}`,
  });
  await expect(confirm).toBeFocused();
  await confirm.click();
  await expect(library(page).getByRole("status")).toContainText(
    "se han borrado",
  );
  await expect(play).toHaveText("Jugar");

  await library(page)
    .getByRole("button", { name: `Opciones de ${NAME}` })
    .click();
  await library(page).getByRole("button", { name: "Ocultar para mí" }).click();
  await expect(library(page).locator("li.card")).toHaveCount(0);
  await library(page).getByText("Ocultos para ti (1)").click();
  await library(page)
    .getByRole("button", { name: `Mostrar ${NAME}` })
    .click();
  await expect(library(page).locator("li.card")).toHaveCount(1);
});

test("a damaged copy on the device is refused with a clear message", async ({
  page,
}) => {
  await page.goto("/");
  await playAndLeave(page);
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("roms");
    for await (const name of (dir as any).keys()) {
      const file = await dir.getFileHandle(name);
      const stream = await file.createWritable();
      await stream.write(new Uint8Array([1, 2, 3]));
      await stream.close();
    }
  });
  await continueCard(page).getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("alert")).toContainText("dañada");
  await expect(page.getByRole("alert")).toContainText(
    "tus partidas siguen guardadas",
  );
  await exit(page);
  await expect(continueCard(page)).toBeVisible();
});

test("the home screen with a library fits a 375 px phone", async ({ page }) => {
  await page.goto("/");
  await playAndLeave(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(continueCard(page)).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("«Continuar» works offline in the installed build", async ({
  page,
  context,
  baseURL,
}) => {
  test.skip(
    !baseURL?.includes(":4173"),
    "The service worker only exists in the production build (preview).",
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-offline-ready",
    "true",
  );
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await playAndLeave(page);
  await context.setOffline(true);
  await page.reload();
  await continueCard(page).getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByTestId("toast")).toContainText(
    "Partida cargada: al salir",
  );
  await running(page);
  await context.setOffline(false);
});

test.describe("load diagnostics", () => {
  test.use({ serviceWorkers: "block" });
  test("a remembered ROM is hashed only once on resume", async ({ page }) => {
    const { patchWorker } = await import("./play.ts");
    await page.goto("/");
    await playAndLeave(page);
    const size = (await game()).buffer.length;
    await patchWorker(
      page,
      `{
      const digest = crypto.subtle.digest.bind(crypto.subtle);
      let romHashes = 0;
      crypto.subtle.digest = (algorithm, data) => {
        if (data.byteLength === ${size} && ++romHashes > 1) throw new Error("ROM hashed twice");
        return digest(algorithm, data);
      };
    }`,
    );
    await continueCard(page).getByRole("button", { name: "Continuar" }).click();
    await running(page);
    // Restored snapshots already contain frames: wait for new advance samples.
    const before = Number(
      await page.locator("canvas").getAttribute("data-frames"),
    );
    await expect
      .poll(async () =>
        Number(await page.locator("canvas").getAttribute("data-frames")),
      )
      .toBeGreaterThan(before + 5);
    await page.keyboard.press("Escape");
    await page.getByText("Rendimiento de la sesión", { exact: true }).click();
    await expect(page.getByTestId("load-duration")).toContainText(
      "Preparación del juego:",
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});

test("profiles share cartridges but keep their resume state and recent games", async ({
  page,
}) => {
  await page.goto("/");
  await playAndLeave(page);
  await page
    .getByRole("button", { name: "Perfil: Jugador 1. Cambiar de perfil" })
    .click();
  await page.getByRole("button", { name: "Añadir perfil" }).click();
  await page
    .getByRole("form", { name: "Nuevo perfil" })
    .getByLabel("Nombre")
    .fill("Ana");
  await page.getByRole("button", { name: "Crear perfil" }).click();
  await page
    .getByRole("list", { name: "Perfiles" })
    .getByRole("button", { name: "Ana", exact: true })
    .click();
  await expect(continueCard(page)).toHaveCount(0);
  await games(page);
  await expect(library(page).getByRole("listitem")).toHaveCount(1);
  await expect(library(page)).toContainText("Aún no has jugado");
  await library(page)
    .getByRole("button", { name: `Jugar ${NAME}`, exact: true })
    .click();
  await running(page);
  await expect(
    page.getByRole("dialog", { name: "Continuar donde lo dejaste" }),
  ).toHaveCount(0);
  await exit(page);
  await expect(
    library(page).getByRole("button", { name: `Continuar ${NAME}` }),
  ).toBeVisible();
  // Deleting this profile removes its progress, never the shared cartridge.
  await page
    .getByRole("button", { name: "Perfil: Ana. Cambiar de perfil" })
    .click();
  await page.getByRole("button", { name: "Gestionar perfiles" }).click();
  await page.getByRole("button", { name: "Borrar Ana", exact: true }).click();
  await page.getByRole("button", { name: "Borrar Ana", exact: true }).click();
  await expect(
    page.getByText("Ana y sus partidas se han borrado", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Listo", exact: true }).click();
  await page
    .getByRole("list", { name: "Perfiles" })
    .getByRole("button", { name: "Jugador 1", exact: true })
    .click();
  await games(page);
  await library(page)
    .getByRole("button", { name: `Continuar ${NAME}` })
    .click();
  await expect(page.getByTestId("toast")).toContainText(
    "Partida cargada: al salir",
  );
  await running(page);
});

test("a manual snapshot is offered as Cargar partida and filters survive playing", async ({
  page,
}) => {
  await page.goto("/");
  await playAndLeave(page);
  // Move the committed automatic snapshot to slot 2, as an existing manual save.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("cartivo-states");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction(["states", "meta"], "readwrite");
    for (const name of ["states", "meta"]) {
      const store = tx.objectStore(name);
      const r = store.openCursor();
      r.onsuccess = () => {
        const row = r.result;
        if (!row) return;
        if (String(row.key).endsWith(":auto")) {
          store.put(
            { ...row.value, slot: "2" },
            String(row.key).replace(/:auto$/, ":2"),
          );
          row.delete();
        }
        row.continue();
      };
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await games(page);
  await library(page).getByRole("searchbox").fill("mi-juego");
  await library(page).getByRole("combobox").selectOption("name");
  await library(page)
    .getByRole("button", { name: `Cargar partida ${NAME}` })
    .click();
  await expect(page.getByTestId("toast")).toContainText(
    "Partida cargada: ranura 2",
  );
  await running(page);
  await exit(page);
  await expect(library(page).getByRole("searchbox")).toHaveValue("mi-juego");
  await expect(library(page).getByRole("combobox")).toHaveValue("name");
  await expect(
    library(page).getByRole("button", { name: `Continuar ${NAME}` }),
  ).toBeFocused();
});

test("legacy libraries and v1 snapshots migrate without copying progress to another profile", async ({
  page,
}) => {
  await page.goto("/");
  // Let the initial reader finish, then seed the previous release's databases.
  await games(page);
  await expect(library(page)).toContainText("Aún no hay juegos");
  await page.evaluate(async () => {
    const remove = (name: string) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.deleteDatabase(name);
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
      });
    await remove("cartivo-catalogue");
    await remove("cartivo-states");
    const seed = async (
      name: string,
      storeName: string,
      value: object,
      key?: string,
    ) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open(name, 1);
        r.onupgradeneeded = () =>
          r.result.createObjectStore(
            storeName,
            key ? undefined : { keyPath: "hash" },
          );
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const tx = db.transaction(storeName, "readwrite");
      if (key) tx.objectStore(storeName).put(value, key);
      else tx.objectStore(storeName).put(value);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    };
    const hash = "a".repeat(64);
    await seed("cartivo-library", "games", {
      hash,
      name: "Legado.nes",
      system: "nes",
      size: 1024,
      addedAt: 1,
      lastPlayedAt: 2,
    });
    await seed(
      "cartivo-states",
      "states",
      {
        slot: "auto",
        core: "tetanes",
        coreVersion: "0.17.0",
        createdAt: 3,
        frames: 4,
        size: 2,
        bytes: new Uint8Array([7, 8]),
        sha256: "old-digest",
      },
      `${hash}:auto`,
    );
  });
  await page.reload();
  await expect(
    library(page).getByRole("button", { name: "Continuar Legado.nes" }),
  ).toBeVisible();
  const migrated = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("cartivo-states");
      r.onsuccess = () => resolve(r.result);
    });
    const read = (store: string) =>
      new Promise<any>((resolve) => {
        const r = db
          .transaction(store)
          .objectStore(store)
          .get("a".repeat(64) + ":auto");
        r.onsuccess = () => resolve(r.result);
      });
    const [record, metadata] = await Promise.all([
      read("states"),
      read("meta"),
    ]);
    const result = {
      version: db.version,
      bytes: Array.from(record.bytes),
      digest: record.sha256,
      indexedBytes: metadata.bytes,
    };
    db.close();
    return result;
  });
  expect(migrated).toEqual({
    version: 2,
    bytes: [7, 8],
    digest: "old-digest",
    indexedBytes: undefined,
  });
  await deleteFromDevice(page, "Legado.nes");
  await page.reload();
  await expect(library(page).getByRole("listitem")).toHaveCount(0);
});

test("leaving after a failed resume does not replace the saved snapshot", async ({
  page,
}) => {
  await page.goto("/");
  await playAndLeave(page);
  const snapshot = async (damage: boolean) =>
    page.evaluate(async (damage) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open("cartivo-states");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const tx = db.transaction("states", damage ? "readwrite" : "readonly");
      const store = tx.objectStore("states");
      const record = await new Promise<any>((resolve) => {
        const r = store.openCursor();
        r.onsuccess = () => {
          const row = r.result!;
          if (damage) {
            row.value.bytes[0] ^= 255;
            row.update(row.value);
          }
          resolve(row.value);
        };
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return {
        createdAt: record.createdAt,
        sha256: record.sha256,
        bytes: Array.from(record.bytes),
      };
    }, damage);
  const before = await snapshot(true);
  await continueCard(page).getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("player-phase")).toHaveText("En pausa");
  await exit(page);
  expect(await snapshot(false)).toEqual(before);
});

// A PlayStation disc (ADR-015): its files are copied to the device while it
// plays, and the copy, shared by profiles, is what «Continuar» opens.
const DISC = "Cartivo Demo.cue";

/** Picks the .cue and its track together from the PlayStation card. */
async function openDisc(page: Page) {
  const { ps1DiscDemo } =
    await import("../../packages/fixtures/src/ps1-disc-demo.ts");
  const { cue, bin } = ps1DiscDemo();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("article", { name: "PlayStation", exact: true })
    .getByRole("button", { name: "Jugar", exact: true })
    .click();
  await (
    await chooser
  ).setFiles([
    {
      name: DISC,
      mimeType: "application/octet-stream",
      buffer: Buffer.from(cue),
    },
    {
      name: "Cartivo Demo (Track 1).bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.from(bin),
    },
  ]);
}

const discCard = (page: Page) =>
  page.getByRole("article", { name: DISC, exact: true });

test("a PS1 disc is copied while it plays and every profile opens that copy", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await openDisc(page);
  await running(page);
  await expect(page.getByTestId("toast")).toContainText(
    "Disco guardado en «Tus juegos»",
  );
  await exit(page);
  await expect(discCard(page)).toContainText("PlayStation");

  // Another profile sees the shared disc and plays it without its files.
  let chooser = false;
  page.on("filechooser", () => (chooser = true));
  await page
    .getByRole("button", { name: "Perfil: Jugador 1. Cambiar de perfil" })
    .click();
  await page.getByRole("button", { name: "Añadir perfil" }).click();
  const create = page.getByRole("form", { name: "Nuevo perfil" });
  await create.getByLabel("Nombre").fill("Ana");
  await create.getByRole("button", { name: "Crear perfil" }).click();
  await page
    .getByRole("list", { name: "Perfiles" })
    .getByRole("button", { name: "Ana", exact: true })
    .click();
  await games(page);
  await library(page)
    .getByRole("button", { name: `Jugar ${DISC}` })
    .click();
  await running(page);
  await expect(page.getByRole("heading", { name: DISC })).toBeVisible();
  await exit(page);
  // Hidden for Ana only.
  await games(page);
  await library(page)
    .getByRole("button", { name: `Opciones de ${DISC}` })
    .click();
  await library(page).getByRole("button", { name: "Ocultar para mí" }).click();
  await expect(library(page).locator("li.card")).toHaveCount(0);
  await page.getByRole("link", { name: "Volver al inicio" }).click();
  await page
    .getByRole("button", { name: "Perfil: Ana. Cambiar de perfil" })
    .click();
  await page
    .getByRole("list", { name: "Perfiles" })
    .getByRole("button", { name: "Jugador 1", exact: true })
    .click();

  // Jugador 1 still has it: «Continuar» opens the copy after a reload.
  await page.reload();
  await discCard(page).getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByTestId("toast")).toContainText(
    "Partida cargada: al salir",
  );
  await running(page);
  expect(chooser).toBe(false);
  await exit(page);

  // Deleted from the device, its Partidas (and memory card) stay.
  await games(page);
  await deleteFromDevice(page, DISC);
  await page.getByRole("link", { name: "Volver al inicio" }).click();
  await openDisc(page);
  await expect(
    page.getByRole("dialog", { name: "Continuar donde lo dejaste" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

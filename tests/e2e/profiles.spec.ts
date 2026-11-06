import { test, expect, type Page } from "./fixtures.ts";
import { playDemo } from "./play.ts";

// Player profiles (ADR-016): asked on every visit, each with its own
// Partidas, library and controls; the first one keeps the existing data.
test.use({ profile: undefined });

const pick = (page: Page, name: string) =>
  page
    .getByRole("list", { name: "Perfiles" })
    .getByRole("button", { name, exact: true })
    .click();

async function slotOne(page: Page) {
  await playDemo(page, "NES");
  await page.getByRole("button", { name: "Partidas" }).click();
  return page
    .getByRole("region", { name: "Partidas" })
    .locator('[data-slot="1"]');
}

async function leave(page: Page) {
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Elige una consola" }),
  ).toBeVisible();
}

test("¿Quién juega? on every visit; profiles keep their Partidas and controls apart", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "¿Quién juega?" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Ajustes" })).toHaveCount(0);

  // Jugador 1 (everything saved before profiles) saves slot 1.
  await pick(page, "Jugador 1");
  let slot = await slotOne(page);
  await page.getByRole("button", { name: "Guardar en Ranura 1" }).click();
  await expect(slot).toContainText("TetaNES");
  await leave(page);

  // A new profile starts empty: no Partida, default keys.
  await page
    .getByRole("button", { name: "Perfil: Jugador 1. Cambiar de perfil" })
    .click();
  await page.getByRole("button", { name: "Nuevo perfil" }).click();
  await page.getByLabel("Nombre del perfil").fill("Ana");
  await page.getByRole("button", { name: "Crear perfil" }).click();
  await expect(page.getByText("Perfil creado: Ana.")).toBeVisible();
  await pick(page, "Ana");
  slot = await slotOne(page);
  await expect(slot).toContainText("Vacía");
  await leave(page);
  await page.getByRole("link", { name: "Ajustes" }).click();
  const keyA = page.getByRole("button", {
    name: "Asignar tecla A",
    exact: true,
  });
  await expect(keyA).toHaveText("A = L");
  await keyA.click();
  await page.keyboard.press("KeyC");
  await expect(keyA).toHaveText("A = C");

  // A reload keeps Ana for this tab; Jugador 1 keeps its own keys and slot.
  await page.reload();
  await expect(keyA).toHaveText("A = C");
  await page.goto("/");
  await page
    .getByRole("button", { name: "Perfil: Ana. Cambiar de perfil" })
    .click();
  await pick(page, "Jugador 1");
  await page.getByRole("link", { name: "Ajustes" }).click();
  await expect(keyA).toHaveText("A = L");
  await page.goto("/");
  slot = await slotOne(page);
  await expect(slot).toContainText("TetaNES");
  await leave(page);

  // A new visit asks again.
  const again = await page.context().newPage();
  await again.goto("/");
  await expect(
    again.getByRole("heading", { name: "¿Quién juega?" }),
  ).toBeVisible();
  await again.close();
});

test("profiles are renamed and deleted with their data; the first one stays", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nuevo perfil" }).click();
  await page.getByLabel("Nombre del perfil").fill("Luis");
  await page.getByRole("button", { name: "Crear perfil" }).click();
  await page.getByRole("button", { name: "Gestionar perfiles" }).click();
  await expect(
    page.getByRole("button", { name: "Borrar Jugador 1" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Renombrar Jugador 1" }).click();
  await page.getByLabel("Nuevo nombre de Jugador 1").fill("Casa");
  await page.getByRole("button", { name: "Guardar" }).click();
  // The first click asks; the confirmation takes its place.
  const remove = page.getByRole("button", { name: "Borrar Luis" });
  await remove.click();
  await expect(
    page.getByText("Se borran sus partidas, juegos y controles."),
  ).toBeVisible();
  await remove.click();
  await expect(
    page.getByText("Luis y sus partidas se han borrado"),
  ).toBeVisible();
  const list = page.getByRole("list", { name: "Perfiles" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await page.reload();
  await expect(
    list.getByRole("button", { name: "Casa", exact: true }),
  ).toBeVisible();
  await expect(
    list.getByRole("button", { name: "Luis", exact: true }),
  ).toHaveCount(0);
});

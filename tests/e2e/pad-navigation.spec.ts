// Cartivo's own screens with a gamepad (synthetic standard pad). A real pad
// is still checked by hand (H1-QA): this proves the wiring, not the device.
import { expect, test, type Page } from "./fixtures.ts";
import { playDemo, playing } from "./play.ts";

const A = 0;
const B = 1;
const SELECT = 8;
const START = 9;
const DOWN = 13;
const LEFT = 14;
const RIGHT = 15;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const pad = {
      index: 0,
      id: "Synthetic standard pad",
      mapping: "standard",
      connected: true,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      axes: [0, 0],
    };
    Object.assign(window, { cartivoPad: pad });
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad] });
  });
});

/** Holds the buttons for a few frames, then lets go of them. */
async function press(page: Page, ...buttons: number[]) {
  const set = (down: boolean) =>
    page.evaluate(
      ([list, down]) => {
        const pad = (window as any).cartivoPad;
        for (const b of list as number[]) {
          pad.buttons[b].pressed = down;
          pad.buttons[b].value = down ? 1 : 0;
        }
      },
      [buttons, down] as const,
    );
  await set(true);
  await page.waitForTimeout(120);
  await set(false);
  await page.waitForTimeout(80);
}

const focusedName = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? "";
  });

test("the D-pad moves between cards; leaving a game refocuses its card", async ({
  page,
}) => {
  await page.goto("/");
  const nes = page
    .getByRole("article", { name: "NES", exact: true })
    .getByRole("button", { name: "Jugar", exact: true });
  await nes.focus();
  await press(page, RIGHT);
  await expect(nes).not.toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-input", "pad");
  await press(page, LEFT);
  await expect(nes).toBeFocused();
  // A on «Jugar» opens the system file picker (not drivable by a pad), so
  // the game starts from the demo entry while the card holds the focus.
  await playDemo(page, "NES");
  // Leaving with the pad gives the focus back to the control that started
  // the game; the pad stays inside the player meanwhile.
  await press(page, SELECT, START);
  const menu = page.getByRole("dialog", { name: "En pausa" });
  for (let i = 0; i < 6; i++) await press(page, DOWN);
  await expect(
    menu.getByRole("button", { name: "Guardar y salir" }),
  ).toBeFocused();
  await press(page, A);
  await expect(nes).toBeFocused();
});

test("modo consola: Select+Start opens the pause menu; Partidas and B", async ({
  page,
}) => {
  await page.goto("/");
  await playDemo(page, "NES");
  // Playing with the pad switches the automatic interface to «Mando».
  await press(page, SELECT, START);
  await expect(page.getByTestId("player-phase")).toHaveText("En pausa");
  await expect(page.locator("html")).toHaveAttribute("data-ui", "pad");
  const menu = page.getByRole("dialog", { name: "En pausa" });
  const resume = menu.getByRole("button", { name: "Reanudar juego" });
  await expect(resume).toBeFocused();

  await press(page, DOWN);
  await expect(
    menu.getByRole("button", { name: "Guardar ahora" }),
  ).toBeFocused();
  await press(page, DOWN);
  await expect(menu.getByRole("button", { name: "Partidas" })).toBeFocused();
  await press(page, A);
  await expect(page.getByRole("heading", { name: "Partidas" })).toBeVisible();
  await expect(menu).toBeHidden();
  await press(page, B);
  await expect(page.getByRole("heading", { name: "Partidas" })).toBeHidden();
  await expect(resume).toBeFocused();

  // B in the menu goes back to the game.
  await press(page, B);
  await playing(page);
});

test("modo consola: «Guardar y salir» from the pause menu", async ({
  page,
}) => {
  await page.goto("/");
  await playDemo(page, "NES");
  await press(page, SELECT, START);
  const menu = page.getByRole("dialog", { name: "En pausa" });
  await expect(
    menu.getByRole("button", { name: "Reanudar juego" }),
  ).toBeFocused();
  // Reanudar → Guardar ahora → Partidas → Ajustes del juego → Controles →
  // Reiniciar → Guardar y salir: the keyboard pause's order.
  for (let i = 0; i < 6; i++) await press(page, DOWN);
  await expect(
    menu.getByRole("button", { name: "Guardar y salir" }),
  ).toBeFocused();
  await press(page, A);
  await expect(
    page.getByRole("heading", { name: "Elige una consola" }),
  ).toBeVisible();
  await expect(page.locator(".pad-hints")).toBeVisible();
});

test("automatic interface follows the device; Ajustes can fix «Mando»", async ({
  page,
}) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-ui", "pointer");
  await page
    .getByRole("article", { name: "NES", exact: true })
    .getByRole("button", { name: "Jugar", exact: true })
    .focus();
  await press(page, RIGHT);
  await expect(html).toHaveAttribute("data-ui", "pad");
  await expect(page.locator(".pad-hints")).toContainText("Aceptar");
  await page.mouse.click(5, 5);
  await expect(html).toHaveAttribute("data-ui", "pointer");
  await expect(page.locator(".pad-hints")).toHaveCount(0);

  await page.goto("/#controles");
  const choice = page.getByRole("group", { name: "Interfaz" });
  await choice.getByText("Mando", { exact: true }).click();
  await expect(html).toHaveAttribute("data-ui", "pad");
  await page.mouse.click(5, 5);
  await expect(html).toHaveAttribute("data-ui", "pad");
  await page.reload();
  await expect(html).toHaveAttribute("data-ui", "pad");
  await choice.getByText("Automática", { exact: true }).click();
  await expect(html).toHaveAttribute("data-ui", "pointer");
});

test("on Controls, B goes back and the test keeps the focus", async ({
  page,
}) => {
  await page.goto("/#controles");
  const zone = page.getByRole("button", {
    name: "Zona de prueba de controles",
  });
  await zone.focus();
  await press(page, A);
  await expect(page.getByTestId("input-status")).toContainText("Prueba activa");
  // While testing, the D-pad is a control under test, not navigation.
  await press(page, DOWN);
  await expect(zone).toBeFocused();
  await press(page, SELECT, START);
  await expect(page.getByTestId("input-status")).toContainText(
    "Prueba detenida",
  );
  await press(page, DOWN);
  await expect(zone).not.toBeFocused();
  expect(await focusedName(page)).not.toBe("");

  await press(page, B);
  await expect(page).not.toHaveURL(/#controles/);
  await expect(page.locator("#inicio")).toBeVisible();
});

test("gameplay activity switches UI, keyboard takes over, disconnect pauses", async ({
  page,
}) => {
  await page.goto("/");
  await playDemo(page, "NES");
  const html = page.locator("html");
  await press(page, A);
  await expect(html).toHaveAttribute("data-ui", "pad");
  await page.keyboard.press("l");
  await expect(html).toHaveAttribute("data-ui", "pointer");
  await press(page, A);
  await expect(html).toHaveAttribute("data-ui", "pad");
  await page.evaluate(() => {
    (window as any).cartivoPad.connected = false;
  });
  await expect(html).toHaveAttribute("data-ui", "pointer");
  await expect(page.getByTestId("player-phase")).toHaveText("En pausa");
  const metrics = page.getByText("Rendimiento de la sesión", { exact: true });
  await metrics.click();
  await expect(page.getByText(/Worker, ida y vuelta/)).toBeVisible();
});

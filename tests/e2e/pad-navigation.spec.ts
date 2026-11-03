// Cartivo's own screens with a gamepad (synthetic standard pad). A real pad
// is still checked by hand (H1-QA): this proves the wiring, not the device.
import { expect, test, type Page } from "@playwright/test";
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

test("the D-pad moves between cards and A starts a demo", async ({ page }) => {
  await page.goto("/");
  const nes = page
    .getByRole("article", { name: "NES", exact: true })
    .getByRole("button", { name: "Probar demo" });
  await nes.focus();
  await press(page, RIGHT);
  await expect(nes).not.toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-input", "pad");
  await press(page, LEFT);
  await expect(nes).toBeFocused();
  await press(page, A);
  await playing(page);
});

test("Select+Start pauses; A resumes; Partidas closes with B", async ({
  page,
}) => {
  await page.goto("/");
  await playDemo(page, "NES");
  await press(page, SELECT, START);
  await expect(page.getByTestId("player-phase")).toHaveText("En pausa");
  const resume = page.getByRole("button", { name: "Reanudar juego" });
  await expect(resume).toBeFocused();

  const saves = page.getByRole("button", { name: "Partidas" });
  await saves.focus();
  await press(page, A);
  await expect(page.getByRole("heading", { name: "Partidas" })).toBeVisible();
  await press(page, B);
  await expect(page.getByRole("heading", { name: "Partidas" })).toBeHidden();
  await expect(saves).toBeFocused();

  await resume.focus();
  await press(page, A);
  await playing(page);
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

import { expect, test } from "@playwright/test";

/**
 * Il giro che deve funzionare sempre: aprire l'app la prima volta, aggiungere
 * una serie a mano, segnare una puntata, esportare il backup — e trovare nel
 * file la puntata segnata. Se uno di questi passi si rompe, la libreria non
 * serve più a niente.
 */
test("avvio, aggiunta di un titolo, una puntata segnata, esportazione", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");

  // Primo avvio: il benvenuto, e si salta.
  await expect(page.getByRole("dialog", { name: "Primo avvio" })).toBeVisible();
  await page.getByRole("button", { name: "Guardo da solo" }).click();
  await expect(page.getByRole("dialog", { name: "Primo avvio" })).toBeHidden();

  // Aggiungere una serie a mano, senza catalogo.
  await page.getByRole("button", { name: "Aggiungi titolo" }).first().click();
  await page.getByRole("button", { name: "Inserisci a mano" }).click();
  await page.getByPlaceholder("Titolo").fill("Serie di prova");
  await page.getByLabel("Tipo").selectOption("serie");
  await page.getByLabel("Ep. totali").fill("10");
  await page.getByRole("button", { name: "Aggiungi alla libreria" }).click();
  await expect(page.getByText("«Serie di prova» aggiunto alla libreria.").or(page.getByText('"Serie di prova" aggiunto alla libreria.'))).toBeVisible();

  // Aprirla e segnare la prima puntata dalla griglia.
  await page.goto("/libreria");
  await page.getByRole("button", { name: /Apri dettagli di Serie di prova/ }).first().click();
  await page.getByRole("tab", { name: "Episodi" }).click();
  await page.getByRole("button", { name: /^S1 · E1\b(?!0)/ }).click();
  await expect(page.getByText("1 di 10 episodi")).toBeVisible();
  await page.keyboard.press("Escape");

  // Esportare il backup e leggerlo.
  await page.getByRole("button", { name: "Impostazioni" }).first().click();
  await page.getByRole("button", { name: /^Dati e backup/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Esporta la libreria/ }).click(),
  ]);
  const path = await download.path();
  const { readFile } = await import("node:fs/promises");
  const backup = JSON.parse(await readFile(path!, "utf8"));

  expect(backup.app).toBe("cinemate");
  expect(backup.version).toBe(6);
  const serie = backup.items.find((i: { title: string }) => i.title === "Serie di prova");
  expect(serie.seen).toBe(1);
  expect(serie.watched).toEqual([expect.objectContaining({ season: 1, episode: 1 })]);
  expect(backup.history.some((h: { action: string; episode?: number }) => h.action === "episode" && h.episode === 1)).toBe(true);

  expect(errors).toEqual([]);
});

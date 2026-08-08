import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Il banco di prova.
 *
 * Nello spirito di `scripts/contrast.mjs`: nessun framework, nessun watcher,
 * nessuna configurazione: file che si eseguono e stampano PASS o FAIL. Girano
 * su Node con `--experimental-strip-types`, quindi i moduli TypeScript si
 * importano come sono, senza un passo di compilazione da tenere allineato.
 *
 * Copre la parte del codice dove un errore non si vede a occhio: il ritmo
 * delle richieste, le scadenze della cache, i punteggi degli umori. L'interfaccia
 * resta fuori di proposito — lì l'occhio funziona meglio di un'asserzione.
 */
const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here)
  .filter((f) => f.endsWith(".test.ts"))
  .sort();

let failed = 0;

for (const file of files) {
  console.log(`\n\x1b[1m── ${file}\x1b[0m`);
  const code = await new Promise((resolve) => {
    spawn(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", "--import", join(here, "register.mjs"), join(here, file)],
      { stdio: "inherit" },
    ).on("close", resolve);
  });
  if (code !== 0) failed++;
}

console.log(
  failed === 0
    ? `\n\x1b[32m${files.length} file di prova, tutti passati.\x1b[0m`
    : `\n\x1b[31m${failed} file di prova su ${files.length} con errori.\x1b[0m`,
);
process.exit(failed === 0 ? 0 : 1);

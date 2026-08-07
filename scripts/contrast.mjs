#!/usr/bin/env node
/**
 * Verifica del contrasto: ogni coppia testo/sfondo che l'app usa davvero.
 *
 * La specifica dichiarava da tempo «ogni coppia ≥ WCAG AA, verificata da
 * script». Lo script non c'era: era una promessa sulla parola, e una promessa
 * sulla parola su un tema che cambia è quella che si rompe per prima — è
 * successo con i grigi lillà del vecchio fondo melanzana, leggibili sulla
 * carta e no sullo schermo.
 *
 * Legge i valori veri da `src/index.css` (niente elenco parallelo da tenere
 * allineato a mano), compone le trasparenze sul fondo giusto e calcola il
 * rapporto secondo WCAG 2.1. Fallisce con codice 1 se qualcosa è sotto la
 * soglia, così può stare in una verifica automatica invece che in un rito.
 *
 *   node scripts/contrast.mjs          elenca solo i fallimenti
 *   node scripts/contrast.mjs --all    stampa tutte le coppie
 */

import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

/** Le soglie WCAG 2.1: testo normale, testo grande (≥24px o ≥19px grassetto), componenti. */
const AA_TEXT = 4.5;
const AA_LARGE = 3;
const AA_UI = 3;

function block(selector) {
  // Tutti i blocchi con quel selettore, non solo il primo: le pastiglie del
  // voto stanno in un secondo `:root` più in basso nel foglio, e leggerne uno
  // solo faceva mancare in silenzio metà delle coppie da controllare.
  const vars = {};
  let from = 0;
  let found = false;
  for (;;) {
    const start = css.indexOf(`${selector} {`, from);
    if (start < 0) break;
    found = true;
    const end = css.indexOf("\n}", start);
    for (const [, name, value] of css.slice(start, end).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
      vars[name] = value.trim();
    }
    from = end;
  }
  if (!found) throw new Error(`Blocco ${selector} non trovato in src/index.css`);
  return vars;
}

const dark = block(":root");
const light = { ...dark, ...block(".light") };

function parse(color) {
  const value = color.trim();
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const parts = rgba[1].split(",").map((p) => Number(p.trim()));
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  }
  return null;
}

/** Un colore con alpha sopra un fondo opaco: il colore che l'occhio vede. */
function flatten([r, g, b, a], [br, bg, bb]) {
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
}

function luminance([r, g, b]) {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(fg, bg) {
  const back = parse(bg);
  const front = flatten(parse(fg), back);
  const [l1, l2] = [luminance(front), luminance(back)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** I fondi su cui l'app disegna testo, in ordine di quanto sono usati. */
const SURFACES = ["bg", "surface", "surface-2", "surface-hover"];

function pairs(vars) {
  const out = [];
  const add = (fg, bg, min, note) => out.push({ fg, bg, min, note, value: ratio(vars[fg], vars[bg]) });

  // Testo corrente su ogni superficie.
  for (const surface of SURFACES) {
    add("text", surface, AA_TEXT);
    add("text-muted", surface, AA_TEXT);
    add("text-faint", surface, AA_TEXT);
    add("accent-text", surface, AA_TEXT);
  }

  // Colori che portano significato, usati come testo o come icona.
  for (const tone of ["cyan", "yellow", "danger", "status-watching", "status-done", "status-planned", "status-dropped", "status-hold"]) {
    add(tone, "bg", AA_LARGE, "testo grande / icona");
    add(tone, "surface-2", AA_LARGE, "testo grande / icona");
  }

  // Testo scritto *sopra* un riempimento pieno.
  add("accent-contrast", "accent", AA_TEXT);
  add("cyan-contrast", "cyan", AA_TEXT);
  add("yellow-contrast", "yellow", AA_TEXT);
  add("danger-contrast", "danger", AA_TEXT);

  // La scala dei voti: numeri grandi sul fondo, e l'inchiostro sulle pastiglie.
  for (let i = 1; i <= 10; i += 1) {
    add(`vote-${i}`, "bg", AA_LARGE, "cifra grande");
    add(`vote-${i}`, "surface-2", AA_LARGE, "cifra grande");
    out.push({
      fg: "vote-fill-ink",
      bg: `vote-fill-${i}`,
      min: AA_TEXT,
      note: "pastiglia del voto",
      value: ratio(dark["vote-fill-ink"], dark[`vote-fill-${i}`]),
    });
  }

  // Il bordo forte è un componente, non testo: deve staccarsi dal fondo.
  add("border-strong", "bg", AA_UI, "bordo");
  add("border-strong", "surface-2", AA_UI, "bordo");

  return out;
}

let failures = 0;
let checked = 0;
const showAll = process.argv.includes("--all");

for (const [name, vars] of [["scuro", dark], ["chiaro", light]]) {
  const rows = pairs(vars);
  checked += rows.length;
  const bad = rows.filter((r) => r.value < r.min);
  failures += bad.length;

  console.log(`\nTema ${name} — ${rows.length} coppie, ${bad.length} sotto soglia`);
  for (const row of showAll ? rows : bad) {
    const mark = row.value < row.min ? "✗" : "·";
    const detail = row.note ? `  (${row.note})` : "";
    console.log(
      `  ${mark} ${row.fg} su ${row.bg}: ${row.value.toFixed(2)}:1 (minimo ${row.min})${detail}`,
    );
  }
}

console.log(`\n${checked} coppie verificate, ${failures} sotto soglia.`);
process.exit(failures === 0 ? 0 : 1);

/**
 * Sposta i testi dell'interfaccia nei dizionari (src/locales/it.ui.ts).
 *
 * Usa il parser di TypeScript, non espressioni regolari: prende solo
 *   - il testo fra i tag JSX,
 *   - gli attributi visibili scritti come stringa (aria-label, placeholder,
 *     title, alt, label, hint, description, note…),
 *   - le stringhe e i template nei rami di una condizione dentro il JSX,
 *   - i messaggi passati a pushToast / setError / setErr / showNotification,
 * e li sostituisce con t("chiave") — o t("chiave", { v0: … }) per i template.
 * L'italiano nel dizionario è il testo di prima, carattere per carattere:
 * nell'app in italiano non cambia niente.
 *
 * Con --strings prende anche le frasi scritte fuori dal JSX — i motivi dei
 * consigli, gli errori, le guide — cioè ogni stringa con almeno uno spazio e
 * una parola italiana, tranne quelle che fanno da valore: chiavi di oggetto,
 * confronti, `case`, tipi, gli stati dei titoli (salvati in italiano nei
 * backup). Le eccezioni puntuali stanno in un file: --skip=elenco.json, una
 * lista di inizi di frase da lasciare come sono (i prompt per il modello…).
 *
 * Uso: node scripts/i18n-extract.cjs [--dry] [--strings] [--skip=f.json] file…
 * (senza file: tutto src/)
 */
const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(SRC, "locales", "it.ui.ts");
const dry = process.argv.includes("--dry");
const strings = process.argv.includes("--strings");
const skipArg = process.argv.find((a) => a.startsWith("--skip="));
const SKIP_TEXT = skipArg ? JSON.parse(fs.readFileSync(skipArg.slice(7), "utf8")) : [];
// --only=elenco.json: solo le frasi che iniziano così (per quelle senza parole «riconoscibili»).
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY_TEXT = onlyArg ? JSON.parse(fs.readFileSync(onlyArg.slice(7), "utf8")) : null;
// Gli stati dei titoli: si mostrano con statusLabel, ma il valore resta questo.
const VALUES = new Set(["Da vedere", "In visione", "Visto", "Abbandonato", "In pausa"]);
const ITALIAN_WORD = /\b(di|il|la|le|lo|gli|un|una|non|per|che|con|del|della|dei|sul|nel|alla|da|tra|fra|ancora|titolo|titoli|episodi|episodio|stagione|giorni|giorno|mesi|serie|film|visto|visti|oggi|domani|ieri|ore|minuti|voto|perché|anche|più|sono|hai|tuo|tua|tuoi)\b|[àèéìòù]/i;

const ATTRS = new Set(["aria-label", "placeholder", "title", "alt", "label", "hint", "description", "note", "subtitle", "empty", "action", "caption", "why", "aria-description", "aria-valuetext", "what"]);
// Attributi che portano codice, non testo.
const CODE_ATTRS = new Set(["className", "style", "key", "type", "id", "role", "href", "src", "to", "rel", "target", "name", "value", "inputMode", "autoComplete", "d", "viewBox", "fill", "stroke", "transform", "pattern", "accept", "srcSet", "sizes", "loading", "decoding", "fetchPriority"]);
const MESSAGE_CALLS = new Set(["pushToast", "setError", "setErr", "showNotification", "setMessage", "setNote", "setStatusText"]);
const SKIP = [/[\\/]locales[\\/]/, /DesignPreview/, /design-preview/, /[\\/]lib[\\/]i18n\.ts$/];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

const files = process.argv.slice(2).filter((a) => !a.startsWith("--")).map((f) => path.resolve(f));
const targets = (files.length ? files : walk(SRC)).filter((f) => !SKIP.some((r) => r.test(f)));

// Il dizionario esistente: chiavi e testi già estratti.
const existing = new Map();
if (fs.existsSync(OUT)) {
  const text = fs.readFileSync(OUT, "utf8");
  for (const m of text.matchAll(/^\s*"([^"]+)":\s*(".*"),?\s*$/gm)) existing.set(m[1], JSON.parse(m[2]));
}
const byText = new Map();
for (const [k, v] of existing) if (!byText.has(`${k.split(".")[0]}|${v}`)) byText.set(`${k.split(".")[0]}|${v}`, k);

const ITALIAN = /[a-zà-ù]{2,}/i;
// Valori che il codice confronta o passa al browser, non parole.
const TECH = new Set(["active", "unknown", "text", "password", "transparent", "none", "hidden", "eager", "lazy", "high", "auto", "true", "new", "entrambi"]);
function looksLikeText(s) {
  const t = s.trim();
  if (t.length < 2 || !ITALIAN.test(t)) return false;
  if (/^https?:|^\/|^#|^[a-z]+:\/\//.test(t)) return false; // indirizzi
  // classi CSS e simili: ogni parola fatta di minuscole, cifre, - : / [ ]
  const tokens = t.split(/\s+/);
  if (tokens.every((w) => /^[a-z0-9:[\]/\-.%!_#(),{}]+$/.test(w)) && tokens.some((w) => /[-:[]/.test(w))) return false;
  if (TECH.has(t) || existing.has(t) || /^[A-Za-z_]+\.[\w.]+$/.test(t)) return false; // chiavi già fatte
  if (/^[a-z]+(-[a-z]+)+$/.test(t)) return false; // identificativi
  if (/^[a-z][a-zA-Z]+$/.test(t) && /[A-Z]/.test(t)) return false; // camelCase
  return true;
}

function slug(text) {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\{v\d+\}/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 4)
      .join("_") || "testo"
  );
}

const added = new Map(); // chiave → testo
function keyFor(area, text) {
  const id = `${area}|${text}`;
  if (byText.has(id)) return byText.get(id);
  let base = `${area}.${slug(text)}`;
  let key = base;
  let n = 2;
  while (existing.has(key) || added.has(key)) key = `${base}_${n++}`;
  added.set(key, text);
  byText.set(id, key);
  return key;
}

function areaOf(file) {
  const rel = path.relative(SRC, file).replace(/\\/g, "/");
  const stem = path.basename(file).replace(/\.(tsx|ts)$/, "");
  const prefix = rel.startsWith("player/") ? "player_" : "";
  return (prefix + stem).replace(/[^A-Za-z0-9_]/g, "_");
}

/** Il testo di un template con ${…} sostituiti da {v0}, {v1}… e le espressioni. */
function template(node, sf) {
  let text = node.head.text;
  const vars = [];
  node.templateSpans.forEach((span, i) => {
    text += `{v${i}}` + span.literal.text;
    vars.push(span.expression.getText(sf));
  });
  return { text, vars };
}

function call(key, vars) {
  if (!vars || vars.length === 0) return `t(${JSON.stringify(key)})`;
  return `t(${JSON.stringify(key)}, { ${vars.map((v, i) => `v${i}: ${v}`).join(", ")} })`;
}

function insideJsx(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxExpression(p) || ts.isJsxAttribute(p)) return true;
    if (ts.isFunctionLike(p) || ts.isSourceFile(p)) return false;
  }
  return false;
}

function isConditionalBranch(node) {
  let n = node;
  while (n.parent && ts.isParenthesizedExpression(n.parent)) n = n.parent;
  const p = n.parent;
  if (!p) return false;
  if (ts.isConditionalExpression(p) && (p.whenTrue === n || p.whenFalse === n)) return true;
  if (ts.isBinaryExpression(p) && p.right === n && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(p.operatorToken.kind)) return true;
  if (ts.isJsxExpression(p)) return true;
  return false;
}

/** Una frase da tradurre, non un valore che il codice confronta o salva. */
function isPhrase(node) {
  const text = ts.isTemplateExpression(node) ? template(node, node.getSourceFile()).text : node.text;
  const bare = text.replace(/\{v\d+\}/g, "").trim();
  const p = node.parent;
  const inPlural = ts.isCallExpression(p) && p.expression.getText() === "plural" && p.arguments.indexOf(node) > 0;
  if (ONLY_TEXT) {
    const exact = process.argv.includes("--exact");
    if (!ONLY_TEXT.some((o) => (exact ? text === o : text.startsWith(o)))) return false;
  } else if (!inPlural && (!bare.includes(" ") || !ITALIAN_WORD.test(bare))) return false;
  if (VALUES.has(text) || SKIP_TEXT.some((s) => text.startsWith(s))) return false;
  if ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p)) && p.name === node) return false;
  if (ts.isLiteralTypeNode(p) || ts.isCaseClause(p) || ts.isElementAccessExpression(p) || ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return false;
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword].includes(p.operatorToken.kind)) return false;
  for (let a = p; a; a = a.parent) {
    if (ts.isJsxAttribute(a) && CODE_ATTRS.has(a.name.getText())) return false; // className, style…
    if (ts.isCallExpression(a)) {
      const callee = a.expression.getText();
      if (callee === "t" || callee.startsWith("console.")) return false;
    }
    if (ts.isTemplateExpression(a) || ts.isTaggedTemplateExpression(a)) return false; // dentro un'altra frase
  }
  return true;
}

let total = 0;
for (const file of targets) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const area = areaOf(file);
  const edits = [];

  function visit(node) {
    // Testo fra i tag.
    if (ts.isJsxText(node)) {
      const raw = node.getText(sf);
      const core = raw.trim();
      if (looksLikeText(core) && !/[{}<>]/.test(core)) {
        const start = node.getStart(sf) + raw.indexOf(core);
        const text = core.replace(/\s*\n\s*/g, " ");
        edits.push({ start, end: start + core.length, replacement: `{${call(keyFor(area, text))}}` });
      }
      return;
    }
    // Attributi visibili scritti come stringa.
    if (ts.isJsxAttribute(node) && node.initializer && ATTRS.has(node.name.getText(sf))) {
      const init = node.initializer;
      if (ts.isStringLiteral(init) && looksLikeText(init.text)) {
        edits.push({ start: init.getStart(sf), end: init.getEnd(), replacement: `{${call(keyFor(area, init.text))}}` });
        return;
      }
    }
    // Stringhe e template nei rami del JSX o dentro un attributo.
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && insideJsx(node) && isConditionalBranch(node) && looksLikeText(node.text)) {
      edits.push({ start: node.getStart(sf), end: node.getEnd(), replacement: call(keyFor(area, node.text)) });
      return;
    }
    if (ts.isTemplateExpression(node) && insideJsx(node) && (isConditionalBranch(node) || ts.isJsxExpression(node.parent))) {
      const { text, vars } = template(node, sf);
      if (looksLikeText(text.replace(/\{v\d+\}/g, ""))) {
        edits.push({ start: node.getStart(sf), end: node.getEnd(), replacement: call(keyFor(area, text), vars) });
        return;
      }
    }
    // Fuori dal JSX (--strings): le frasi, non i valori.
    if (strings && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) && isPhrase(node)) {
      const { text, vars } = ts.isTemplateExpression(node) ? template(node, sf) : { text: node.text, vars: [] };
      const wrapped = ts.isJsxAttribute(node.parent) ? `{${call(keyFor(area, text), vars)}}` : call(keyFor(area, text), vars);
      edits.push({ start: node.getStart(sf), end: node.getEnd(), replacement: wrapped });
      return;
    }
    // Messaggi.
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : "";
      if (MESSAGE_CALLS.has(name)) {
        for (const arg of node.arguments) {
          if ((ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) && looksLikeText(arg.text) && arg.text.includes(" ")) {
            edits.push({ start: arg.getStart(sf), end: arg.getEnd(), replacement: call(keyFor(area, arg.text)) });
          } else if (ts.isTemplateExpression(arg)) {
            const { text, vars } = template(arg, sf);
            if (looksLikeText(text.replace(/\{v\d+\}/g, "")) && text.includes(" ")) {
              edits.push({ start: arg.getStart(sf), end: arg.getEnd(), replacement: call(keyFor(area, text), vars) });
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  if (edits.length === 0) continue;

  edits.sort((a, b) => b.start - a.start);
  if (process.argv.includes("--show")) for (const e of [...edits].reverse()) console.log(`      ${src.slice(e.start, e.end).replace(/\s+/g, " ").slice(0, 90)}`);
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.replacement + out.slice(e.end);

  // L'import di t.
  const rel = path.relative(path.dirname(file), path.join(SRC, "lib", "i18n")).replace(/\\/g, "/");
  const spec = rel.startsWith(".") ? rel : `./${rel}`;
  const importRe = new RegExp(`import \\{([^}]*)\\} from "${spec.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}";`);
  const m = out.match(importRe);
  if (m) {
    const names = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    if (!names.includes("t")) out = out.replace(importRe, `import { ${[...names, "t"].join(", ")} } from "${spec}";`);
  } else {
    const lines = out.split("\n");
    let last = -1;
    for (let i = 0; i < lines.length; i++) if (/^import\b/.test(lines[i])) last = i;
    if (last >= 0) {
      let j = last;
      while (!/;\s*$/.test(lines[j])) j++;
      lines.splice(j + 1, 0, `import { t } from "${spec}";`);
    } else lines.unshift(`import { t } from "${spec}";`);
    out = lines.join("\n");
  }
  total += edits.length;
  console.log(`${String(edits.length).padStart(4)}  ${path.relative(ROOT, file)}`);
  if (!dry) fs.writeFileSync(file, out);
}

if (!dry && added.size) {
  const all = new Map([...existing, ...added]);
  const body = [...all].map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
  fs.writeFileSync(
    OUT,
    `/**\n * I testi dell'interfaccia, estratti dai componenti da scripts/i18n-extract.cjs.\n * Le chiavi sono «file.prime_parole»; l'inglese sta in en.ui.ts.\n */\nconst itUi = {\n${body}\n} as const;\n\nexport default itUi;\n`,
  );
}
console.log(`\n${total} testi spostati, ${added.size} chiavi nuove${dry ? " (prova: niente scritto)" : ""}.`);

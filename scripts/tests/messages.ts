/**
 * Nei test non c'è Vite, quindi nessuno registra le frasi modulo per modulo
 * (scripts/vite-i18n.ts): qui si registrano tutte, come se ogni modulo
 * avesse portato le sue.
 */
const { default: it } = await import("../../src/locales/it.ts");
const { default: en } = await import("../../src/locales/en.ts");
const { registerMessages } = await import("../../src/lib/i18n.ts");

const all: Record<string, readonly [string, string]> = {};
for (const key of Object.keys(it) as (keyof typeof it)[]) all[key] = [it[key], en[key]];
registerMessages(all);

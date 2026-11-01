import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Plugin } from 'vite'

/**
 * I testi viaggiano con il modulo che li usa.
 *
 * I dizionari (`src/locales/`) restano la fonte unica, tipizzata: una chiave
 * senza inglese è un errore di compilazione. Ma un dizionario intero dentro lo
 * script d'ingresso farebbe pagare a ogni apertura i testi di tutte le pagine,
 * anche di quelle che non si aprono mai — e 1400 frasi in due lingue sono più
 * di quanto pesi il resto della prima schermata.
 *
 * Così, a ogni modulo di `src/` che nomina una chiave, questo plugin aggiunge
 * in testa la registrazione delle sue frasi, in italiano e in inglese:
 * `registerMessages({ "Area.chiave": ["…", "…"] })`. La frase finisce nello
 * stesso pezzo di bundle del componente: la pagina del lettore porta i testi
 * del lettore, e nessun altro li scarica.
 */
const SRC = resolve(import.meta.dirname, '../src')
const LOCALES = resolve(SRC, 'locales')
const I18N = resolve(SRC, 'lib/i18n.ts')

type Pair = [it: string, en: string]

/** Legge un dizionario TypeScript così com'è, con i suoi import relativi. */
function loadTs(file: string, cache: Map<string, Record<string, unknown>>): Record<string, unknown> {
  const hit = cache.get(file)
  if (hit) return hit
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  })
  const mod = { exports: {} as Record<string, unknown> }
  const require = (spec: string) => loadTs(resolve(dirname(file), spec.endsWith('.ts') ? spec : `${spec}.ts`), cache)
  // I dizionari sono nostri e senza effetti: valutarli qui è come importarli.
  new Function('module', 'exports', 'require', outputText)(mod, mod.exports, require)
  cache.set(file, mod.exports)
  return mod.exports
}

export function loadMessages(): Map<string, Pair> {
  const cache = new Map<string, Record<string, unknown>>()
  const it = loadTs(resolve(LOCALES, 'it.ts'), cache).default as Record<string, string>
  const en = loadTs(resolve(LOCALES, 'en.ts'), cache).default as Record<string, string>
  return new Map(Object.keys(it).map((k) => [k, [it[k], en[k] ?? it[k]]]))
}

export function inlineMessages(): Plugin {
  let messages: Map<string, Pair> | null = null
  return {
    name: 'cinemate:i18n',
    enforce: 'pre',
    configureServer(server) {
      server.watcher.on('change', (file) => {
        if (!file.startsWith(LOCALES)) return
        messages = null
        server.moduleGraph.invalidateAll()
        server.ws.send({ type: 'full-reload' })
      })
    },
    transform(code, id) {
      const file = id.split('?')[0]
      if (!/\.[jt]sx?$/.test(file) || !file.startsWith(SRC) || file.startsWith(LOCALES)) return
      messages ??= loadMessages()
      const used: Record<string, Pair> = {}
      for (const m of code.matchAll(/(["'])([A-Za-z_]\w*\.[\w.]+)\1/g)) {
        const pair = messages.get(m[2])
        if (pair) used[m[2]] = pair
      }
      if (Object.keys(used).length === 0) return
      const call = `(${JSON.stringify(used)});`
      // In testa e sulla stessa riga: le righe del sorgente restano dove sono.
      if (file === I18N) return { code: `${code}\nregisterMessages${call}\n`, map: null }
      return { code: `import { registerMessages as __messages } from ${JSON.stringify(I18N)};__messages${call}${code}`, map: null }
    },
  }
}

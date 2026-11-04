import { register } from "node:module";
register("./ts-resolve.mjs", import.meta.url);
// Le frasi dell'interfaccia, che nell'app registra il plugin di Vite.
await import("./messages.ts");

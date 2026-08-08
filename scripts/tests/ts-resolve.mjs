import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    try { return await next(specifier, context); } catch (e) {
      for (const ext of [".ts", ".tsx"]) {
        try {
          const url = new URL(specifier + ext, context.parentURL);
          if (existsSync(fileURLToPath(url))) return await next(specifier + ext, context);
        } catch {}
      }
      throw e;
    }
  }
  return next(specifier, context);
}

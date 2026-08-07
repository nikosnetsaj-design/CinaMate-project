/**
 * The accent colours the app can wear.
 *
 * A free colour picker is deliberately not on offer. The design system's one
 * hard promise is that every text/background pair clears WCAG AA — 168 of them,
 * checked by script — and an arbitrary hex chosen from a wheel breaks that on
 * the first try, silently, in a way nobody notices until someone can't read a
 * button. So each accent ships as a curated set with its own dark and light
 * variants, picked to clear AA against both themes' surfaces.
 *
 * Three of the six are the Technicolor dyes the identity is built from
 * (§4 of PRODUCT.md); the other three extend the same three-strip logic rather
 * than wandering off into a generic swatch grid.
 */
export interface AccentVariant {
  /** Fills: buttons, bars, the active pill. Paired with `contrast` for text on it. */
  accent: string;
  /** The same hue as *text* on the page background — a different job, a different value. */
  accentText: string;
  /** Text drawn on top of `accent`. */
  accentContrast: string;
}

export interface Accent {
  id: string;
  name: string;
  dark: AccentVariant;
  light: AccentVariant;
}

export const ACCENTS: Accent[] = [
  {
    id: "magenta",
    name: "Magenta",
    dark: { accent: "#ff4d9e", accentText: "#ff6fb0", accentContrast: "#24071a" },
    light: { accent: "#d6007a", accentText: "#a80060", accentContrast: "#ffffff" },
  },
  {
    id: "ciano",
    name: "Ciano",
    dark: { accent: "#3fd3e8", accentText: "#5fdcee", accentContrast: "#04222a" },
    light: { accent: "#006e7d", accentText: "#005f6b", accentContrast: "#ffffff" },
  },
  {
    id: "giallo",
    name: "Giallo",
    dark: { accent: "#ffc24d", accentText: "#ffd076", accentContrast: "#2a1c00" },
    light: { accent: "#8a5c00", accentText: "#7a5200", accentContrast: "#ffffff" },
  },
  {
    id: "verde",
    name: "Verde",
    dark: { accent: "#22c55e", accentText: "#4ade80", accentContrast: "#04220f" },
    light: { accent: "#157f3c", accentText: "#116632", accentContrast: "#ffffff" },
  },
  {
    id: "viola",
    name: "Viola",
    dark: { accent: "#b490f0", accentText: "#c4a7f4", accentContrast: "#1a0b33" },
    light: { accent: "#6634b8", accentText: "#5a2ca3", accentContrast: "#ffffff" },
  },
  {
    id: "corallo",
    name: "Corallo",
    dark: { accent: "#ff8a7a", accentText: "#ffa397", accentContrast: "#2c0803" },
    light: { accent: "#b8362a", accentText: "#9c2a21", accentContrast: "#ffffff" },
  },
];

/**
 * Il verde è il predefinito: sul nero è il colore più leggibile della
 * tavolozza, ed è quello che ogni app di visione usa per «vai». Chi ne ha
 * scelto un altro se lo tiene — la scelta salvata vince sempre sul default.
 */
export const DEFAULT_ACCENT = "verde";

export function accentById(id: string): Accent {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS.find((a) => a.id === DEFAULT_ACCENT) ?? ACCENTS[0];
}

/**
 * Writes the chosen accent onto the document as inline custom properties.
 *
 * Inline rather than a class per accent because these three variables are also
 * read by `color-mix()` in a dozen components: overriding them at the root is
 * the one place that reaches every use, including the ones written as
 * `color-mix(in srgb, var(--accent) 16%, transparent)`.
 *
 * The default accent clears the properties instead of setting them, so the
 * stylesheet's own values stay in charge — that way the light theme's accent
 * still switches with the theme for anyone who never touched this setting.
 */
export function applyAccent(accentId: string, theme: "dark" | "light") {
  const root = document.documentElement;
  if (accentId === DEFAULT_ACCENT) {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-text");
    root.style.removeProperty("--accent-contrast");
    return;
  }
  const variant = accentById(accentId)[theme];
  root.style.setProperty("--accent", variant.accent);
  root.style.setProperty("--accent-text", variant.accentText);
  root.style.setProperty("--accent-contrast", variant.accentContrast);
}

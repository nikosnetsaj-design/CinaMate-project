/**
 * The accent colours the app can wear.
 *
 * A free colour picker is deliberately not on offer. The design system's one
 * hard promise is that every text/background pair clears WCAG AA, checked by
 * `npm run contrast` — which reads this list too — and an arbitrary hex chosen
 * from a wheel breaks that on the first try, silently, in a way nobody notices
 * until someone can't read a button. So each accent ships as a curated set
 * with its own dark and light variants, picked to clear AA against both
 * themes' surfaces.
 *
 * Tutti e sette stanno sulla stessa carta calda: toni un po' spenti, mai i
 * colori pieni di un'interfaccia da cruscotto. Gli id sono quelli di prima,
 * così chi ne aveva scelto uno se lo ritrova, ricalibrato.
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
    id: "brace",
    name: "Brace",
    dark: { accent: "#dc7a54", accentText: "#ec9670", accentContrast: "#1a0b05" },
    light: { accent: "#b0502c", accentText: "#9f4624", accentContrast: "#ffffff" },
  },
  {
    id: "corallo",
    name: "Corallo",
    dark: { accent: "#ec8b78", accentText: "#f2a293", accentContrast: "#2a0c06" },
    light: { accent: "#b2442f", accentText: "#9e3b28", accentContrast: "#ffffff" },
  },
  {
    id: "giallo",
    name: "Ocra",
    dark: { accent: "#e0b062", accentText: "#e8c07e", accentContrast: "#1f1405" },
    light: { accent: "#865900", accentText: "#7a5100", accentContrast: "#ffffff" },
  },
  {
    id: "verde",
    name: "Salvia",
    dark: { accent: "#93bf86", accentText: "#a6cc9a", accentContrast: "#0f1d0c" },
    light: { accent: "#3d7536", accentText: "#36682f", accentContrast: "#ffffff" },
  },
  {
    id: "ciano",
    name: "Lago",
    dark: { accent: "#75b4c0", accentText: "#8fc3cd", accentContrast: "#071a1e" },
    light: { accent: "#2f6e79", accentText: "#285f69", accentContrast: "#ffffff" },
  },
  {
    id: "viola",
    name: "Glicine",
    dark: { accent: "#ad98d9", accentText: "#bdace2", accentContrast: "#1a1030" },
    light: { accent: "#6a4ca8", accentText: "#5d4296", accentContrast: "#ffffff" },
  },
  {
    id: "magenta",
    name: "Lampone",
    dark: { accent: "#e183a8", accentText: "#ea9bba", accentContrast: "#2a0a17" },
    light: { accent: "#a8335f", accentText: "#962c54", accentContrast: "#ffffff" },
  },
];

/**
 * La brace è il predefinito: è l'accento su cui è costruito il sistema, ed è
 * quello del foglio di stile. Chi ne ha scelto un altro se lo tiene — la
 * scelta salvata vince sempre sul default.
 */
export const DEFAULT_ACCENT = "brace";

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

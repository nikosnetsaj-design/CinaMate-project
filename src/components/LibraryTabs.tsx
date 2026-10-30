import { NavLink } from "react-router-dom";
import { prefetchHandlers } from "../lib/prefetch";

/**
 * Titoli · Saghe · Liste: tre modi di guardare lo stesso scaffale.
 *
 * Il commento della barra lo diceva già — «Saghe è una scheda dentro
 * Libreria» — ma nella Libreria quella scheda non c'era: sul telefono le saghe
 * si raggiungevano solo dalla riga «Continua la saga», che compare soltanto se
 * ce n'è una a metà. Adesso stanno qui, accanto ai titoli e alle liste, sulla
 * pagina che la barra chiama Libreria.
 *
 * Sono collegamenti e non schede: ognuna ha il suo indirizzo, quindi il tasto
 * Indietro, una scorciatoia salvata e un link condiviso portano dove ci si
 * aspetta.
 */
const TABS = [
  { to: "/libreria", label: "Titoli" },
  { to: "/saghe", label: "Saghe" },
  { to: "/liste", label: "Liste" },
] as const;

export function LibraryTabs() {
  return (
    <nav aria-label="Sezioni della libreria" className="segmented segmented-full sm:max-w-sm">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} viewTransition {...prefetchHandlers(tab.to)}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

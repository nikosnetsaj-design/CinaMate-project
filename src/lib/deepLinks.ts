/**
 * "Apri sul servizio": dal nome di una piattaforma al suo indirizzo di ricerca.
 *
 * Tre decisioni che vale la pena spiegare, perché sono limiti veri e non
 * pigrizia:
 *
 * 1. **Si apre la ricerca, non la scheda del titolo.** Nessun catalogo
 *    pubblico — TMDB compreso — espone l'identificativo che Netflix o Disney+
 *    usano internamente per un film: JustWatch quegli indirizzi ce li ha
 *    perché li raccoglie servizio per servizio, e non li presta. Quello che si
 *    può costruire onestamente è la ricerca del servizio già compilata col
 *    titolo, che è un tocco invece di dieci. L'interfaccia lo dice invece di
 *    far finta che sia un collegamento diretto.
 * 2. **Solo indirizzi `https://`, mai schemi propri** tipo `nflx://`. Su
 *    telefono un indirizzo del sito è già un universal link: se l'app è
 *    installata la apre il sistema, se non c'è resta una pagina web. Uno schema
 *    proprio, quando l'app manca, lascia il browser su una navigazione morta.
 * 3. **Solo i servizi il cui indirizzo di ricerca è stato verificato.** Sky /
 *    NOW, HBO Max e Mediaset Infinity non sono qui perché non hanno una rotta
 *    di ricerca stabile e indovinarla significa mandare la gente su un 404: per
 *    loro resta il collegamento a JustWatch, che è meno diretto ma funziona.
 *
 * L'anno non entra nella ricerca: i motori interni dei servizi lo trattano come
 * una parola qualsiasi e "Dune 2021" spesso non trova nulla, mentre "Dune"
 * trova entrambi i film in cima.
 */

/** Un servizio raggiungibile, già risolto sul titolo che si sta guardando. */
export interface ServiceLink {
  /** Il servizio come lo chiama chi guarda: "Prime Video", non "primevideo". */
  service: string;
  url: string;
}

interface Service {
  label: string;
  /** Nomi normalizzati con cui il servizio arriva da TMDB o dalla libreria. */
  aliases: string[];
  search: (query: string) => string;
}

/**
 * Confronto fra nomi resistente alla punteggiatura: TMDB scrive "Disney Plus",
 * la libreria "Disney+", e sono la stessa cosa.
 */
function normalize(name: string): string {
  return name.toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]/g, "");
}

const SERVICES: Service[] = [
  {
    label: "Netflix",
    aliases: ["netflix"],
    search: (q) => `https://www.netflix.com/search?q=${q}`,
  },
  {
    label: "Prime Video",
    aliases: ["primevideo", "amazonprimevideo", "amazonvideo"],
    search: (q) => `https://www.primevideo.com/search?phrase=${q}`,
  },
  {
    // Disney+ ha spostato la ricerca sotto /browse: il vecchio /search?q=
    // risponde 404, quindi va tenuto l'indirizzo lungo anche se sembra strano.
    label: "Disney+",
    aliases: ["disneyplus"],
    search: (q) => `https://www.disneyplus.com/it-it/browse/search?q=${q}`,
  },
  {
    // Stessa casa per l'abbonamento e per il noleggio: entrambi finiscono qui.
    label: "Apple TV+",
    aliases: ["appletvplus", "appletv", "itunes"],
    search: (q) => `https://tv.apple.com/it/search?term=${q}`,
  },
  {
    label: "Paramount+",
    aliases: ["paramountplus"],
    search: (q) => `https://www.paramountplus.com/search/?q=${q}`,
  },
  {
    label: "Crunchyroll",
    aliases: ["crunchyroll"],
    search: (q) => `https://www.crunchyroll.com/search?q=${q}`,
  },
  {
    label: "RaiPlay",
    aliases: ["raiplay"],
    search: (q) => `https://www.raiplay.it/ricerca.html?q=${q}`,
  },
  {
    label: "MUBI",
    aliases: ["mubi"],
    search: (q) => `https://mubi.com/it/search/films?query=${q}`,
  },
];

/**
 * Il servizio che corrisponde a un nome, se ne conosciamo la ricerca.
 *
 * Il confronto accetta anche i prefissi perché TMDB distingue i piani come se
 * fossero servizi diversi — "Netflix basic with Ads", "Amazon Prime Video with
 * Ads" — e per aprire la ricerca il piano non conta.
 */
function match(name: string): Service | null {
  const key = normalize(name);
  if (!key) return null;
  for (const service of SERVICES) {
    if (service.aliases.some((alias) => key === alias || key.startsWith(alias))) return service;
  }
  return null;
}

/**
 * L'indirizzo su cui aprire `title` in un servizio, o `null` se quel servizio
 * non ha una ricerca che sappiamo raggiungere.
 */
export function serviceLinkFor(providerName: string, title: string): ServiceLink | null {
  const service = match(providerName);
  if (!service || !title.trim()) return null;
  return { service: service.label, url: service.search(encodeURIComponent(title.trim())) };
}

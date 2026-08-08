import type { ItemDraft } from "./draft";
import { blankDraft } from "./draft";
import type { Kind } from "../types";

/**
 * I titoli impacchettati nell'app, per il primo minuto.
 *
 * Servono a rispondere alla domanda che il primo avvio poneva e lasciava
 * cadere: *com'è CineMate quando è piena?* Prima la risposta era una scatola
 * vuota con dentro un invito a cercare, su un motore che senza chiave del
 * catalogo non risponde mai — l'unico punto dell'app in cui si può restare
 * fermi per sempre.
 *
 * Stanno qui e non su TMDB per la ragione che li rende utili: al primo avvio
 * non c'è una chiave, e spesso non c'è nemmeno una connessione. Nessuno di
 * questi record ha una locandina: la copertina se la disegna `PosterArt` dal
 * titolo, con la sfumatura e le perforazioni, ed è la stessa resa che l'app
 * usa da sempre per i titoli non collegati. Quindi non c'è un'immagine da
 * scaricare, non c'è un byte da chiedere a nessuno, e la griglia è piena in
 * zero millisecondi.
 *
 * Sono anche solo dei *punti di partenza*: il record entra in libreria con il
 * minimo che la rende vera — titolo, tipo, anno, genere, durata — e il resto
 * (trama, cast, copertina, saga) lo riempie il collegamento automatico a TMDB
 * appena una chiave c'è, come per qualunque altro titolo aggiunto a mano.
 * Nessuno di questi dati è inventato o approssimato al ribasso: se l'app li
 * mostrasse per sempre così, sarebbero comunque corretti.
 */
export interface SeedPick {
  title: string;
  kind: Kind;
  year: number;
  genre: string;
  /** Minuti per un film, minuti *per episodio* per una serie. */
  runtime: number;
  seasons?: number;
  episodes?: number;
  director?: string;
}

/**
 * La griglia dei gusti: ciò che si tocca per dire «questo l'ho visto».
 *
 * Larga di proposito — film e serie, anni Novanta e ieri, italiano e
 * giapponese — perché serve a far riconoscere *qualcosa* a chiunque la apra.
 * Una griglia di soli titoli d'autore la attraversa senza toccare niente chi
 * guarda solo serie, e quella persona è esattamente quella che stiamo
 * cercando di non perdere al primo schermo.
 */
export const TASTE_PICKS: SeedPick[] = [
  { title: "Il Padrino", kind: "film", year: 1972, genre: "Drammatico", runtime: 175, director: "Francis Ford Coppola" },
  { title: "Pulp Fiction", kind: "film", year: 1994, genre: "Crime", runtime: 154, director: "Quentin Tarantino" },
  { title: "Interstellar", kind: "film", year: 2014, genre: "Fantascienza", runtime: 169, director: "Christopher Nolan" },
  { title: "Il Signore degli Anelli: La Compagnia dell'Anello", kind: "film", year: 2001, genre: "Fantasy", runtime: 178, director: "Peter Jackson" },
  { title: "Parasite", kind: "film", year: 2019, genre: "Thriller", runtime: 132, director: "Bong Joon-ho" },
  { title: "La vita è bella", kind: "film", year: 1997, genre: "Drammatico", runtime: 116, director: "Roberto Benigni" },
  { title: "Matrix", kind: "film", year: 1999, genre: "Fantascienza", runtime: 136, director: "Lana e Lilly Wachowski" },
  { title: "Il buono, il brutto, il cattivo", kind: "film", year: 1966, genre: "Western", runtime: 178, director: "Sergio Leone" },
  { title: "Spider-Man: Un nuovo universo", kind: "film", year: 2018, genre: "Animazione", runtime: 117 },
  { title: "Oppenheimer", kind: "film", year: 2023, genre: "Storico", runtime: 180, director: "Christopher Nolan" },
  { title: "Inception", kind: "film", year: 2010, genre: "Fantascienza", runtime: 148, director: "Christopher Nolan" },
  { title: "Whiplash", kind: "film", year: 2014, genre: "Drammatico", runtime: 106, director: "Damien Chazelle" },

  { title: "Breaking Bad", kind: "serie", year: 2008, genre: "Crime", runtime: 47, seasons: 5, episodes: 62 },
  { title: "Il Trono di Spade", kind: "serie", year: 2011, genre: "Fantasy", runtime: 57, seasons: 8, episodes: 73 },
  { title: "Stranger Things", kind: "serie", year: 2016, genre: "Fantascienza", runtime: 51, seasons: 4, episodes: 34 },
  { title: "Dark", kind: "serie", year: 2017, genre: "Fantascienza", runtime: 55, seasons: 3, episodes: 26 },
  { title: "The Office", kind: "serie", year: 2005, genre: "Commedia", runtime: 22, seasons: 9, episodes: 201 },
  { title: "Chernobyl", kind: "serie", year: 2019, genre: "Drammatico", runtime: 65, seasons: 1, episodes: 5 },
  { title: "The Bear", kind: "serie", year: 2022, genre: "Drammatico", runtime: 30, seasons: 3, episodes: 28 },
  { title: "Gomorra", kind: "serie", year: 2014, genre: "Crime", runtime: 50, seasons: 5, episodes: 58 },

  { title: "L'attacco dei giganti", kind: "anime", year: 2013, genre: "Azione", runtime: 24, seasons: 4, episodes: 89 },
  { title: "La città incantata", kind: "anime", year: 2001, genre: "Animazione", runtime: 125, director: "Hayao Miyazaki" },
  { title: "Death Note", kind: "anime", year: 2006, genre: "Thriller", runtime: 23, seasons: 1, episodes: 37 },

  { title: "Planet Earth II", kind: "doc", year: 2016, genre: "Natura", runtime: 50, seasons: 1, episodes: 6 },
];

/**
 * Da scelta a record di libreria.
 *
 * Entra come **Visto** e non come «Da vedere»: la domanda posta dalla griglia
 * è «cosa hai già visto», e tradurre quella risposta in una watchlist
 * significherebbe scrivere nella libreria il contrario di ciò che la persona
 * ha appena detto. Per una serie si segnano anche tutti gli episodi: chi
 * dichiara di aver visto Breaking Bad non intende «ho cominciato».
 */
export function seedDraft(pick: SeedPick): ItemDraft {
  const total = pick.episodes ?? null;
  return {
    ...blankDraft(),
    title: pick.title,
    kind: pick.kind,
    year: pick.year,
    genre: pick.genre,
    status: "Visto",
    runtime: pick.runtime,
    seasons: pick.seasons ?? null,
    episodes: total,
    seen: total ?? 0,
    director: pick.director ?? "",
    platform: "Altro",
  };
}

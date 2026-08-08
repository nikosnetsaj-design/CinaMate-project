import { useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useAppReady } from "../lib/useAppReady";
import { greeting } from "../lib/stats";
import { EmptyState } from "../components/EmptyState";
import { GoalsPanel } from "../components/GoalsPanel";
import { ProfileHeader, ProfileSummary } from "./Profile";
import { AchievementsTab, DiaryTab, TasteTab } from "./Stats";

/**
 * Tu — una sola pagina per una sola domanda.
 *
 * Prima erano due destinazioni, «Dati» e «Profilo», e occupavano due delle
 * dieci voci della barra per rispondere entrambe a *quanto guardi, cosa e
 * quando*. Non era una scelta: era una duplicazione cresciuta per aggiunte
 * separate, e la prova stava nei loro stati vuoti — l'app aveva quattro modi
 * diversi di dire «non hai ancora visto niente», uno per ogni superficie che
 * poteva essere vuota da sola.
 *
 * Adesso l'intestazione resta ferma — chi sei secondo le ore che hai messo —
 * e sotto ci sono quattro schede, che sono quattro domande diverse:
 *
 * - **Riepilogo**: ore, giorni di fila, grafico, cosa hai ripreso di recente
 * - **Diario**: cosa hai visto, giorno per giorno
 * - **Gusti**: generi, attori e registi che torni a guardare
 * - **Traguardi**: i livelli raggiunti e gli obiettivi che ti sei dato
 *
 * Il saluto e la data stanno qui e non più in cima alla Home. In Home erano
 * cornice sopra la vetrina — cinque elementi prima del primo pixel di
 * contenuto; qui sono al loro posto, perché questa è l'unica pagina dell'app
 * che parla di te e non di un film.
 */

type Tab = "riepilogo" | "diario" | "gusti" | "traguardi";

const TABS: { id: Tab; label: string }[] = [
  { id: "riepilogo", label: "Riepilogo" },
  { id: "diario", label: "Diario" },
  { id: "gusti", label: "Gusti" },
  { id: "traguardi", label: "Traguardi" },
];

export function Tu() {
  const ready = useAppReady();
  // Le statistiche leggono tutta la libreria e mai la vista filtrata dal
  // controllo genitori: un titolo nascosto è costato le ore che è costato.
  const items = useLibrary((s) => s.items);
  const openItem = useSelectedItem((s) => s.open);
  const [tab, setTab] = useState<Tab>("riepilogo");

  const today = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <p className="t-label text-text-faint">
          {greeting()} · <span className="capitalize">{today}</span>
        </p>
      </div>

      <ProfileHeader />

      {!ready ? null : items.length === 0 ? (
        <EmptyState
          title="Il diario comincia col primo voto."
          description="Aggiungi un titolo e segnalo come visto: ore, generi e traguardi si riempiono da soli."
        />
      ) : (
        <>
          <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Sezioni del profilo">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px shrink-0 rounded-t-sm border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
                  tab === t.id ? "text-text" : "border-transparent text-text-faint hover:text-text-muted"
                }`}
                style={tab === t.id ? { borderColor: "var(--accent)" } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "riepilogo" && <ProfileSummary />}
          {tab === "diario" && <DiaryTab items={items} openItem={openItem} />}
          {tab === "gusti" && <TasteTab items={items} openItem={openItem} />}
          {tab === "traguardi" && (
            <div className="flex flex-col gap-4">
              <AchievementsTab items={items} />
              <GoalsPanel items={items} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

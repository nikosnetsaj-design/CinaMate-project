import { useState } from "react";
import type { FormEvent } from "react";
import { usePlayerSources, EMPTY_SOURCE } from "../store/usePlayerSources";
import type { MarkerType, PlayerSprite } from "../store/usePlayerSources";
import { isStreamUrl } from "./services/manifestKind";
import { formatClock, parseClock } from "./clock";
import { CloseIcon } from "./components/Icons";

/**
 * Per-title configuration for everything the library cannot know: the stream
 * itself, subtitle files, where the intro and credits sit, and the sprite sheet
 * for timeline previews. Without this the player's subtitle customisation,
 * skip buttons and scrub previews are code with no way to reach them.
 *
 * Lives in the bridge layer next to fromLibrary.ts rather than in
 * player/components/, so the module's own components stay free of any
 * knowledge of CineMate's stores.
 */

const MARKERS: { type: MarkerType; label: string }[] = [
  { type: "intro", label: "Intro" },
  { type: "recap", label: "Recap" },
  { type: "credits", label: "Crediti" },
];

function ClockField({
  value,
  onCommit,
  onUseCurrent,
  label,
}: {
  value: number;
  onCommit: (sec: number) => void;
  onUseCurrent: () => void;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatClock(value);
  return (
    <span className="pv-clock-field">
      <input
        aria-label={label}
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const parsed = draft === null ? null : parseClock(draft);
          if (parsed !== null) onCommit(parsed);
          setDraft(null);
        }}
      />
      <button type="button" className="pv-btn-tiny" title="Usa il punto in cui sei ora" onClick={onUseCurrent}>
        ⌖
      </button>
    </span>
  );
}

function SpriteFields({
  sprite,
  onChange,
  onClear,
}: {
  sprite: PlayerSprite | undefined;
  onChange: (sprite: PlayerSprite) => void;
  onClear: () => void;
}) {
  const current: PlayerSprite = sprite ?? {
    url: "",
    interval: 10,
    columns: 10,
    rows: 10,
    tileWidth: 160,
    tileHeight: 90,
    count: 100,
  };
  const numeric: { key: keyof PlayerSprite; label: string }[] = [
    { key: "interval", label: "Secondi per riquadro" },
    { key: "columns", label: "Colonne" },
    { key: "rows", label: "Righe" },
    { key: "tileWidth", label: "Larghezza riquadro" },
    { key: "tileHeight", label: "Altezza riquadro" },
    { key: "count", label: "Riquadri totali" },
  ];

  return (
    <div className="pv-source-block">
      <div className="pv-source-block-head">
        <h5>Anteprime timeline</h5>
        {sprite && (
          <button type="button" className="pv-btn-tiny" onClick={onClear}>
            Rimuovi
          </button>
        )}
      </div>
      <p className="pv-empty">
        Un'unica immagine con i fotogrammi affiancati a griglia: passando sulla barra vedi il
        fotogramma del punto invece del solo minutaggio.
      </p>
      <input
        placeholder="https://…/sprite.jpg"
        value={current.url}
        onChange={(e) => onChange({ ...current, url: e.target.value.trim() })}
      />
      {current.url && (
        <div className="pv-source-grid">
          {numeric.map(({ key, label }) => (
            <label key={key}>
              <span>{label}</span>
              <input
                type="number"
                min={1}
                value={current[key] as number}
                onChange={(e) => onChange({ ...current, [key]: Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function SourcePanel({
  itemId,
  title,
  linkManifest,
  getCurrentTime,
}: {
  itemId: string;
  title: string;
  /** Il link personale del titolo, quando è un manifest `.m3u8` o `.mpd`. */
  linkManifest: string | null;
  getCurrentTime: () => number;
}) {
  const source = usePlayerSources((s) => s.sources[itemId]) ?? EMPTY_SOURCE;
  const patch = usePlayerSources((s) => s.patch);
  const addSubtitle = usePlayerSources((s) => s.addSubtitle);
  const removeSubtitle = usePlayerSources((s) => s.removeSubtitle);
  const setMarker = usePlayerSources((s) => s.setMarker);
  const removeMarker = usePlayerSources((s) => s.removeMarker);

  const [manifestDraft, setManifestDraft] = useState<string | null>(null);
  const [subLabel, setSubLabel] = useState("");
  const [subLang, setSubLang] = useState("it");
  const [subUrl, setSubUrl] = useState("");

  const manifestValue = manifestDraft ?? source.manifestUrl ?? "";
  const manifestInvalid = manifestValue.trim() !== "" && !isStreamUrl(manifestValue.trim());

  const commitManifest = () => {
    if (manifestDraft === null) return;
    const trimmed = manifestDraft.trim();
    patch(itemId, { manifestUrl: trimmed || undefined });
    setManifestDraft(null);
  };

  const submitSubtitle = (e: FormEvent) => {
    e.preventDefault();
    if (!subUrl.trim()) return;
    addSubtitle(itemId, {
      label: subLabel.trim() || subLang.toUpperCase(),
      language: subLang.trim() || "und",
      url: subUrl.trim(),
    });
    setSubLabel("");
    setSubUrl("");
  };

  return (
    <div className="pv-panel pv-source-panel">
      <div className="pv-panel-header">
        <h3>Sorgenti · {title}</h3>
      </div>

      <div className="pv-source-block">
        <div className="pv-source-block-head">
          <h5>Stream</h5>
        </div>
        <input
          placeholder="https://…/master.m3u8 oppure .mpd"
          value={manifestValue}
          onChange={(e) => setManifestDraft(e.target.value)}
          onBlur={commitManifest}
        />
        {manifestInvalid && (
          <p className="pv-download-error">
            Non sembra un manifest: l'indirizzo deve finire in <code>.m3u8</code> (HLS) o{" "}
            <code>.mpd</code> (DASH).
          </p>
        )}
        {!source.manifestUrl && linkManifest && (
          <p className="pv-empty">In uso il link personale del titolo: {linkManifest}</p>
        )}
      </div>

      <div className="pv-source-block">
        <div className="pv-source-block-head">
          <h5>Sottotitoli</h5>
        </div>
        {source.subtitles.length === 0 && (
          <p className="pv-empty">
            Nessuna traccia. Aggiungi un file <code>.vtt</code> e nelle impostazioni del player
            potrai cambiarne dimensione, colore, sfondo, posizione e sincronizzazione.
          </p>
        )}
        {source.subtitles.map((s) => (
          <div key={s.id} className="pv-source-row">
            <span className="pv-source-row-name">
              {s.label} <span className="pv-dim pv-mono">{s.language}</span>
            </span>
            <span className="pv-source-row-url">{s.url}</span>
            <button
              type="button"
              className="pv-icon-btn"
              aria-label={`Rimuovi ${s.label}`}
              onClick={() => removeSubtitle(itemId, s.id)}
            >
              <CloseIcon />
            </button>
          </div>
        ))}
        <form className="pv-source-add" onSubmit={submitSubtitle}>
          <input placeholder="Etichetta (Italiano)" value={subLabel} onChange={(e) => setSubLabel(e.target.value)} />
          <input
            placeholder="it"
            className="pv-source-lang"
            value={subLang}
            onChange={(e) => setSubLang(e.target.value)}
          />
          <input placeholder="https://…/sottotitoli.vtt" value={subUrl} onChange={(e) => setSubUrl(e.target.value)} />
          <button type="submit">Aggiungi</button>
        </form>
      </div>

      <div className="pv-source-block">
        <div className="pv-source-block-head">
          <h5>Salta intro, recap e crediti</h5>
        </div>
        <p className="pv-empty">
          Metti in pausa nel punto giusto e premi ⌖ per prendere il minutaggio dal player.
        </p>
        {MARKERS.map(({ type, label }) => {
          const marker = source.markers.find((m) => m.type === type);
          return (
            <div key={type} className="pv-source-row pv-source-marker">
              <span className="pv-source-row-name">{label}</span>
              <ClockField
                label={`Inizio ${label}`}
                value={marker?.startSec ?? 0}
                onCommit={(sec) => setMarker(itemId, { type, startSec: sec, endSec: marker?.endSec ?? sec + 30 })}
                onUseCurrent={() => {
                  const now = Math.floor(getCurrentTime());
                  setMarker(itemId, { type, startSec: now, endSec: Math.max(marker?.endSec ?? 0, now + 30) });
                }}
              />
              <span className="pv-dim">→</span>
              <ClockField
                label={`Fine ${label}`}
                value={marker?.endSec ?? 0}
                onCommit={(sec) => setMarker(itemId, { type, startSec: marker?.startSec ?? 0, endSec: sec })}
                onUseCurrent={() => {
                  const now = Math.floor(getCurrentTime());
                  setMarker(itemId, { type, startSec: Math.min(marker?.startSec ?? 0, Math.max(0, now - 1)), endSec: now });
                }}
              />
              {marker && (
                <button
                  type="button"
                  className="pv-icon-btn"
                  aria-label={`Rimuovi marker ${label}`}
                  onClick={() => removeMarker(itemId, type)}
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <SpriteFields
        sprite={source.sprite}
        onChange={(sprite) => patch(itemId, { sprite })}
        onClear={() => patch(itemId, { sprite: undefined })}
      />
    </div>
  );
}

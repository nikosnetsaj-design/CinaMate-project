import { useState } from "react";
import { useParental } from "../store/useParental";
import { useLibrary } from "../store/useLibrary";
import { AGE_LABELS, AGE_LEVELS, type AgeLevel } from "../lib/parental";

const PIN_LENGTH = 4;

function PinInput({
  value,
  onChange,
  label,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  id: string;
}) {
  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      <span className="text-xs font-medium uppercase tracking-wide text-text-faint">{label}</span>
      <input
        id={id}
        // `password` rather than `number`: it hides the PIN from anyone looking
        // over a shoulder, which is most of the threat model here, and avoids
        // the spinner arrows that make a numeric field nudgeable by accident.
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={PIN_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
        className="rounded-sm border border-border-strong bg-surface px-3 py-2 font-mono text-lg tracking-[0.4em] text-text"
        placeholder="••••"
      />
    </label>
  );
}

export function ParentalSettings() {
  const state = useParental();
  const pushToast = useLibrary((s) => s.pushToast);

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [maxAge, setMaxAge] = useState<AgeLevel>(state.maxAge);
  const [allowUnrated, setAllowUnrated] = useState(state.allowUnrated);
  const [busy, setBusy] = useState(false);

  const enable = async () => {
    if (pin.length !== PIN_LENGTH) {
      pushToast("error", `Il PIN deve avere ${PIN_LENGTH} cifre.`);
      return;
    }
    if (pin !== confirmPin) {
      pushToast("error", "I due PIN non coincidono.");
      return;
    }
    setBusy(true);
    await state.enable(pin, maxAge, allowUnrated);
    setBusy(false);
    setPin("");
    setConfirmPin("");
    pushToast("success", "Controllo genitori attivo.");
  };

  const disable = async () => {
    setBusy(true);
    const ok = await state.disable(pin);
    setBusy(false);
    setPin("");
    pushToast(ok ? "success" : "error", ok ? "Controllo genitori disattivato." : "PIN errato.");
  };

  const unlock = async () => {
    setBusy(true);
    const ok = await state.unlock(pin);
    setBusy(false);
    setPin("");
    pushToast(ok ? "success" : "error", ok ? "Sbloccato fino alla chiusura dell’app." : "PIN errato.");
  };

  return (
    <div>
      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">
        Controllo genitori
      </span>
      <p className="mb-3 text-xs leading-relaxed text-text-faint">
        Nasconde i titoli oltre l'età scelta, usando la classificazione del film — quella italiana
        quando c'è, altrimenti quella americana. Da dire con chiarezza: tutto vive in questo
        browser, quindi chi sa aprire gli strumenti per sviluppatori può aggirarlo. È una serratura
        da armadietto, non una cassaforte: per farne una servirebbe un account e un server, che
        quest'app non ha per scelta.
      </p>

      {state.enabled ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-sm border px-3 py-2.5 text-sm" style={{ borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)" }}>
            <p className="text-text">
              Attivo · {AGE_LABELS[state.maxAge]}
              {state.allowUnrated ? " · i non classificati sono visibili" : " · i non classificati sono nascosti"}
            </p>
            <p className="mt-0.5 text-xs text-text-faint">
              {state.unlocked
                ? "Sbloccato: stai vedendo tutto. Si richiude da solo alla chiusura dell'app."
                : "Bloccato: i titoli oltre il limite non compaiono in Home, Libreria, ricerca e Player."}
            </p>
          </div>

          {state.unlocked ? (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Limite di età</span>
                <div className="flex flex-wrap gap-2">
                  {AGE_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={state.maxAge === level}
                      onClick={() => state.setRules({ maxAge: level })}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                        state.maxAge === level ? "border-transparent" : "border-border-strong text-text-muted"
                      }`}
                      style={
                        state.maxAge === level
                          ? { background: "var(--accent)", color: "var(--accent-contrast)" }
                          : undefined
                      }
                    >
                      {AGE_LABELS[level]}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-text">
                <input
                  type="checkbox"
                  checked={state.allowUnrated}
                  onChange={(e) => state.setRules({ allowUnrated: e.target.checked })}
                  className="h-4 w-4"
                />
                Mostra anche i titoli senza classificazione
              </label>

              <button
                type="button"
                onClick={state.lock}
                className="w-full rounded-sm border border-border-strong px-3.5 py-2.5 text-sm text-text"
              >
                Richiudi adesso
              </button>
            </>
          ) : (
            <>
              <PinInput id="parental-unlock" value={pin} onChange={setPin} label="PIN per sbloccare" />
              <button
                type="button"
                onClick={unlock}
                disabled={busy || pin.length !== PIN_LENGTH}
                className="w-full rounded-sm py-2.5 text-sm font-semibold disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                Sblocca
              </button>
            </>
          )}

          <button
            type="button"
            onClick={disable}
            disabled={busy || pin.length !== PIN_LENGTH}
            className="w-full rounded-sm border px-3.5 py-2.5 text-sm disabled:opacity-40"
            style={{ borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)", color: "var(--danger)" }}
          >
            Disattiva (serve il PIN)
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Limite di età</span>
            <div className="flex flex-wrap gap-2">
              {AGE_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={maxAge === level}
                  onClick={() => setMaxAge(level)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    maxAge === level ? "border-transparent" : "border-border-strong text-text-muted"
                  }`}
                  style={maxAge === level ? { background: "var(--accent)", color: "var(--accent-contrast)" } : undefined}
                >
                  {AGE_LABELS[level]}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-text">
            <input
              type="checkbox"
              checked={allowUnrated}
              onChange={(e) => setAllowUnrated(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              Mostra anche i titoli senza classificazione
              <span className="mt-0.5 block text-xs text-text-faint">
                Spento per scelta: un titolo che TMDB non ha classificato non è un titolo sicuro, è
                un titolo di cui non si sa nulla.
              </span>
            </span>
          </label>

          <PinInput id="parental-pin" value={pin} onChange={setPin} label="Scegli un PIN" />
          <PinInput id="parental-pin-confirm" value={confirmPin} onChange={setConfirmPin} label="Ripetilo" />

          <button
            type="button"
            onClick={enable}
            disabled={busy || pin.length !== PIN_LENGTH}
            className="w-full rounded-sm py-2.5 text-sm font-semibold disabled:opacity-40"
            style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
          >
            Attiva controllo genitori
          </button>
        </div>
      )}
    </div>
  );
}

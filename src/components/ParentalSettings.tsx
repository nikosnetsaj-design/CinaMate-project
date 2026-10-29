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
      <span className="text-sm font-medium text-text-muted">{label}</span>
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
        className="field w-auto font-mono text-lg tracking-[0.4em]"
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
      <span className="mb-1 block text-base font-semibold text-text">
        Controllo genitori
      </span>
      <p className="mb-4 text-sm text-text-muted">
        Nasconde i titoli oltre l'età scelta, usando la classificazione del film — quella italiana
        quando c'è, altrimenti quella americana. Da dire con chiarezza: tutto vive in questo
        browser, quindi chi sa aprire gli strumenti per sviluppatori può aggirarlo. È una serratura
        da armadietto, non una cassaforte: per farne una servirebbe un account e un server, che
        quest'app non ha per scelta.
      </p>

      {state.enabled ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-md bg-surface-2 px-4 py-3 text-sm">
            <p className="text-text">
              Attivo · {AGE_LABELS[state.maxAge]}
              {state.allowUnrated ? " · i non classificati sono visibili" : " · i non classificati sono nascosti"}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {state.unlocked
                ? "Sbloccato: stai vedendo tutto. Si richiude da solo alla chiusura dell'app."
                : "Bloccato: i titoli oltre il limite non compaiono in Home, Libreria, ricerca e Player."}
            </p>
          </div>

          {state.unlocked ? (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-text-muted">Limite di età</span>
                <div className="flex flex-wrap gap-2">
                  {AGE_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={state.maxAge === level}
                      onClick={() => state.setRules({ maxAge: level })}
                      className="chip"
                    >
                      {AGE_LABELS[level]}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex min-h-11 items-center gap-3 text-sm text-text">
                <input
                  type="checkbox"
                  checked={state.allowUnrated}
                  onChange={(e) => state.setRules({ allowUnrated: e.target.checked })}
                  className="h-5 w-5 shrink-0"
                />
                Mostra anche i titoli senza classificazione
              </label>

              <button
                type="button"
                onClick={state.lock}
                className="btn btn-secondary w-full"
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
                className="btn btn-primary w-full"
              >
                Sblocca
              </button>
            </>
          )}

          <button
            type="button"
            onClick={disable}
            disabled={busy || pin.length !== PIN_LENGTH}
            className="btn btn-danger w-full disabled:opacity-40"
          >
            Disattiva (serve il PIN)
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-text-muted">Limite di età</span>
            <div className="flex flex-wrap gap-2">
              {AGE_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={maxAge === level}
                  onClick={() => setMaxAge(level)}
                  className="chip"
                >
                  {AGE_LABELS[level]}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-3 text-sm text-text">
            <input
              type="checkbox"
              checked={allowUnrated}
              onChange={(e) => setAllowUnrated(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            <span>
              Mostra anche i titoli senza classificazione
              <span className="mt-0.5 block text-xs text-text-muted">
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
            className="btn btn-primary w-full"
          >
            Attiva controllo genitori
          </button>
        </div>
      )}
    </div>
  );
}

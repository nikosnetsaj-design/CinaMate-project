import { useState } from "react";
import { useParental } from "../store/useParental";
import { useLibrary } from "../store/useLibrary";
import { AGE_LABELS, AGE_LEVELS, type AgeLevel } from "../lib/parental";
import { t } from "../lib/i18n";

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
      pushToast("error", t("ParentalSettings.il_pin_deve_avere", { v0: PIN_LENGTH }));
      return;
    }
    if (pin !== confirmPin) {
      pushToast("error", t("ParentalSettings.i_due_pin_non"));
      return;
    }
    setBusy(true);
    await state.enable(pin, maxAge, allowUnrated);
    setBusy(false);
    setPin("");
    setConfirmPin("");
    pushToast("success", t("ParentalSettings.controllo_genitori_attivo"));
  };

  const disable = async () => {
    setBusy(true);
    const ok = await state.disable(pin);
    setBusy(false);
    setPin("");
    pushToast(ok ? "success" : "error", ok ? t("ParentalSettings.controllo_genitori_disattivato") : t("ParentalSettings.pin_errato"));
  };

  const unlock = async () => {
    setBusy(true);
    const ok = await state.unlock(pin);
    setBusy(false);
    setPin("");
    pushToast(ok ? "success" : "error", ok ? t("ParentalSettings.sbloccato_fino_alla_chiusura") : t("ParentalSettings.pin_errato"));
  };

  return (
    <div>
      <span className="mb-1 block text-base font-semibold text-text">
        {t("ParentalSettings.controllo_genitori")}
      </span>
      <p className="mb-4 text-sm text-text-muted">
        {t("ParentalSettings.nasconde_i_titoli_oltre")}
      </p>

      {state.enabled ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-md bg-surface-2 px-4 py-3 text-sm">
            <p className="text-text">
              {t("ParentalSettings.attivo")} {AGE_LABELS[state.maxAge]}
              {state.allowUnrated ? t("ParentalSettings.i_non_classificati_sono") : t("ParentalSettings.i_non_classificati_sono_2")}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {state.unlocked
                ? t("ParentalSettings.sbloccato_stai_vedendo_tutto")
                : t("ParentalSettings.bloccato_i_titoli_oltre")}
            </p>
          </div>

          {state.unlocked ? (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-text-muted">{t("ParentalSettings.limite_di_eta")}</span>
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
                {t("ParentalSettings.mostra_anche_i_titoli")}
              </label>

              <button
                type="button"
                onClick={state.lock}
                className="btn btn-secondary w-full"
              >
                {t("ParentalSettings.richiudi_adesso")}
              </button>
            </>
          ) : (
            <>
              <PinInput id="parental-unlock" value={pin} onChange={setPin} label={t("ParentalSettings.pin_per_sbloccare")} />
              <button
                type="button"
                onClick={unlock}
                disabled={busy || pin.length !== PIN_LENGTH}
                className="btn btn-primary w-full"
              >
                {t("ParentalSettings.sblocca")}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={disable}
            disabled={busy || pin.length !== PIN_LENGTH}
            className="btn btn-danger w-full disabled:opacity-40"
          >
            {t("ParentalSettings.disattiva_serve_il_pin")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-text-muted">{t("ParentalSettings.limite_di_eta")}</span>
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
              {t("ParentalSettings.mostra_anche_i_titoli")}
              <span className="mt-0.5 block text-xs text-text-muted">
                {t("ParentalSettings.spento_per_scelta_un")}
              </span>
            </span>
          </label>

          <PinInput id="parental-pin" value={pin} onChange={setPin} label={t("ParentalSettings.scegli_un_pin")} />
          <PinInput id="parental-pin-confirm" value={confirmPin} onChange={setConfirmPin} label={t("ParentalSettings.ripetilo")} />

          <button
            type="button"
            onClick={enable}
            disabled={busy || pin.length !== PIN_LENGTH}
            className="btn btn-primary w-full"
          >
            {t("ParentalSettings.attiva_controllo_genitori")}
          </button>
        </div>
      )}
    </div>
  );
}

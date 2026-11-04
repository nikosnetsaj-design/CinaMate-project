import { useState } from 'react';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { CloseIcon } from './Icons';
import { t } from "../../lib/i18n";

/**
 * "Ritaglia": segna un momento e mandalo a qualcuno.
 *
 * Netflix qui estrae davvero uno spezzone di video. CineMate non può e non
 * vuole: il file non è suo, sta su un server che hai indicato tu, e ritagliarlo
 * significherebbe copiarlo. Quello che si può fare onestamente è il *punto*:
 * un collegamento che apre il player esattamente lì, con la durata scelta
 * scritta accanto. Il foglio lo dice invece di far credere che parta un video.
 */

export type ClipResult = 'shared' | 'copied' | 'failed';

type Props = {
  /** Dove si trovava la testina quando il foglio si è aperto. */
  startSec: number;
  title: string;
  onShare: (startSec: number, lengthSec: number) => Promise<ClipResult>;
  onClose: () => void;
};

const LENGTHS: { sec: number; label: string }[] = [
  { sec: 15, label: t("player_ClipSheet.15_secondi") },
  { sec: 30, label: t("player_ClipSheet.30_secondi") },
  { sec: 60, label: t("player_ClipSheet.1_minuto") },
];

function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(rest).padStart(2, '0')}`;
}

const MESSAGES: Record<ClipResult, string> = {
  shared: t("player_ClipSheet.momento_condiviso"),
  copied: t("player_ClipSheet.collegamento_copiato_incollalo_dove"),
  failed: t("player_ClipSheet.non_sono_riuscito_a"),
};

export default function ClipSheet({ startSec, title, onShare, onClose }: Props) {
  const panelRef = useFocusTrap(onClose);
  const [length, setLength] = useState(30);
  const [result, setResult] = useState<ClipResult | null>(null);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      setResult(await onShare(startSec, length));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pv-side-overlay pv-side-overlay--center" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("player_ClipSheet.ritaglia_un_momento")}
        className="pv-clip-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pv-side-header">
          <h3>{t("player_ClipSheet.ritaglia")}</h3>
          <button className="pv-icon-btn" aria-label={t("player_ClipSheet.chiudi")} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <p className="pv-clip-range pv-num">
          {clock(startSec)} → {clock(startSec + length)}
        </p>
        <p className="pv-dim pv-clip-note">
          {t("player_ClipSheet.da")}{title}{t("player_ClipSheet.il_collegamento_apre_il")}
        </p>

        <div className="pv-field-options" role="group" aria-label={t("player_ClipSheet.durata_del_momento")}>
          {LENGTHS.map((l) => (
            <button
              key={l.sec}
              type="button"
              className={length === l.sec ? "active" : ''}
              aria-pressed={length === l.sec}
              onClick={() => setLength(l.sec)}
            >
              {l.label}
            </button>
          ))}
        </div>

        <button type="button" className="pv-clip-share" disabled={busy} onClick={share}>
          {busy ? t("player_ClipSheet.preparo_il_collegamento") : t("player_ClipSheet.condividi_il_momento")}
        </button>

        {result && (
          <p className={`pv-clip-result ${result === 'failed' ? 'pv-clip-result--bad' : ''}`} role="status">
            {MESSAGES[result]}
          </p>
        )}
      </div>
    </div>
  );
}

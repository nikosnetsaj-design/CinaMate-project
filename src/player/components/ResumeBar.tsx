import { formatClock } from '../clock';
import { CloseIcon } from './Icons';
import { t } from "../../lib/i18n";

type Props = {
  /** Second the player jumped to. */
  positionSec: number;
  onRestart: () => void;
  onDismiss: () => void;
};

/**
 * Says out loud that the title did not start from the beginning, and offers the
 * way back.
 *
 * The player has always resumed silently. That is right nine times out of ten
 * and wrong in the one case that matters: coming back to something watched
 * months ago, where the honest wish is to start again — and where a silent jump
 * to 01:12:40 looks like a bug, not a feature. Netflix, Prime and Disney+ all
 * put this bar on screen for the same reason.
 *
 * It disappears on its own: an offer, not a decision to be made.
 */
export default function ResumeBar({ positionSec, onRestart, onDismiss }: Props) {
  return (
    <div className="pv-resume-bar" role="status">
      <span className="pv-resume-text">
        {t("player_ResumeBar.ripreso_da")} <span className="pv-num">{formatClock(positionSec)}</span>
      </span>
      <button type="button" className="pv-resume-action" onClick={onRestart}>
        {t("player_ResumeBar.ricomincia_da_capo")}
      </button>
      <button type="button" className="pv-icon-btn pv-resume-close" aria-label={t("player_ResumeBar.chiudi")} onClick={onDismiss}>
        <CloseIcon />
      </button>
    </div>
  );
}

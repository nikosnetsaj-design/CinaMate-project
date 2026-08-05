import { BRIGHTNESS_MAX, BRIGHTNESS_MIN } from '../hooks/usePlayerGestures';
import { BrightnessIcon } from './Icons';

/**
 * La colonna della luminosità, sul bordo sinistro della scena.
 *
 * Fa la stessa cosa dello scorrimento verticale col dito (usePlayerGestures) e
 * serve proprio per questo: il gesto è invisibile finché qualcuno non lo scopre
 * per caso, e chi guarda dal computer non ce l'ha affatto. Vale la pena
 * ripeterlo qui che dimmerare significa scurire *l'immagine*: nessuna pagina
 * web può toccare la retroilluminazione dello schermo.
 */

type Props = {
  value: number;
  onChange: (value: number) => void;
};

export default function BrightnessRail({ value, onChange }: Props) {
  const pct = Math.round(((value - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN)) * 100);
  return (
    <div className="pv-brightness">
      <BrightnessIcon />
      <input
        type="range"
        className="pv-brightness-range"
        min={BRIGHTNESS_MIN}
        max={BRIGHTNESS_MAX}
        step={0.05}
        value={value}
        aria-label="Luminosità dell'immagine"
        aria-valuetext={`${pct}%`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

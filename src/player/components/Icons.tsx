import {
  Captions,
  Cast,
  Check,
  CircleAlert,
  Gauge,
  ListVideo,
  Lock,
  LockOpen,
  Maximize,
  Maximize2,
  Minimize,
  Pause,
  PictureInPicture,
  PictureInPicture2,
  Play,
  Scissors,
  SkipForward,
  SlidersHorizontal,
  Sun,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/*
 * Le icone del lettore: lo stesso disegno del resto dell'app (Lucide, griglia
 * 24, estremità tonde), con un tratto appena più pieno — 2 invece di 1,75 —
 * perché qui stanno sopra un'immagine che si muove, e un filo sottile su una
 * scena chiara sparisce.
 *
 * La misura predefinita resta 18: il foglio di stile del lettore ridimensiona
 * le icone dove serve (`.pv-transport-play svg`, `.pv-action svg`…), e lo fa
 * sull'elemento <svg>, che è quello che Lucide disegna.
 */
const STROKE = 2;

/* Le icone piene tengono anche il tratto: arrotonda gli spigoli del
   triangolo di Play, e la barra di «prossimo episodio» è una linea, che senza
   tratto sparirebbe. */
function Glyph({ icon: Icon, filled = false }: { icon: LucideIcon; filled?: boolean }) {
  return <Icon size={18} strokeWidth={STROKE} fill={filled ? 'currentColor' : 'none'} aria-hidden="true" />;
}

export function PlayIcon() {
  return <Glyph icon={Play} filled />;
}
export function PauseIcon() {
  return <Glyph icon={Pause} filled />;
}
export function VolumeIcon() {
  return <Glyph icon={Volume2} />;
}
export function MuteIcon() {
  return <Glyph icon={VolumeX} />;
}
/*
 * Impostazioni: tre cursori, non un cerchio con i raggi.
 *
 * Il disegno di prima era un sole — cerchio al centro e otto raggi attorno — e
 * questo lettore ha *davvero* un comando per la luminosità: due cose diverse
 * con la stessa figura, una accanto all'altra nella stessa fascia. Tre cursori
 * dicono «qui si regolano delle cose» e non somigliano a nient'altro sulla
 * scena.
 */
export function SettingsIcon() {
  return <Glyph icon={SlidersHorizontal} />;
}
/* Immagine nell'immagine: il riquadro grande e quello piccolo nell'angolo,
   la convenzione che tutti riconoscono. */
export function PipIcon() {
  return <Glyph icon={PictureInPicture2} />;
}
export function CastIcon() {
  return <Glyph icon={Cast} />;
}
export function FullscreenIcon() {
  return <Glyph icon={Maximize} />;
}
export function ExitFullscreenIcon() {
  return <Glyph icon={Minimize} />;
}
/*
 * Mini player: la freccia è tutta la differenza.
 *
 * Senza, sarebbe la stessa figura dell'immagine nell'immagine. Due comandi
 * diversi, affiancati nella stessa fascia, disegnati uguali: non è che si
 * sbagliasse a premere, è che non c'era niente da capire. La freccia che
 * rientra nell'angolo dice cosa fa: la scena si rimpicciolisce lì.
 */
export function MiniPlayerIcon() {
  return <Glyph icon={PictureInPicture} />;
}
export function CloseIcon() {
  return <Glyph icon={X} />;
}
export function CheckIcon() {
  return <Glyph icon={Check} />;
}
export function ExpandIcon() {
  return <Glyph icon={Maximize2} />;
}
export function ErrorIcon() {
  return <Glyph icon={CircleAlert} />;
}

// --- Reazioni --------------------------------------------------------------

export function ThumbUpIcon() {
  return <Glyph icon={ThumbsUp} />;
}
export function ThumbDownIcon() {
  return <Glyph icon={ThumbsDown} />;
}

/** "Adoro": due pollici affiancati, lo stesso pollice disegnato due volte. */
export const ThumbUpDoubleIcon = () => (
  <svg width={22} height={18} viewBox="0 0 30 24" fill="none" aria-hidden="true">
    <ThumbsUp x={-1} y={1.5} width={21} height={21} strokeWidth={STROKE} />
    <ThumbsUp x={10} y={1.5} width={21} height={21} strokeWidth={STROKE} />
  </svg>
);

// --- Blocco comandi --------------------------------------------------------
export function LockIcon() {
  return <Glyph icon={Lock} />;
}
export function UnlockIcon() {
  return <Glyph icon={LockOpen} />;
}
export function BrightnessIcon() {
  return <Glyph icon={Sun} />;
}

// --- Riga di azioni --------------------------------------------------------
export function ScissorsIcon() {
  return <Glyph icon={Scissors} />;
}
export function SpeedIcon() {
  return <Glyph icon={Gauge} />;
}
export function EpisodesIcon() {
  return <Glyph icon={ListVideo} />;
}
export function SubtitlesIcon() {
  return <Glyph icon={Captions} />;
}
export function NextEpisodeIcon() {
  return <Glyph icon={SkipForward} filled />;
}

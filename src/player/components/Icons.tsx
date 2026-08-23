const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const PlayIcon = () => (
  <svg {...base} fill="currentColor" stroke="none"><polygon points="6,4 20,12 6,20" /></svg>
);
export const PauseIcon = () => (
  <svg {...base} fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
);
export const RewindIcon = () => (
  <svg {...base}><polygon points="12,5 3,12 12,19" fill="currentColor" stroke="none" /></svg>
);
export const ForwardIcon = () => (
  <svg {...base}><polygon points="12,5 21,12 12,19" fill="currentColor" stroke="none" /></svg>
);
export const VolumeIcon = () => (
  <svg {...base}>
    <polygon points="4,9 8,9 13,4 13,20 8,15 4,15" fill="currentColor" stroke="none" />
    <path d="M17 8a5 5 0 0 1 0 8" />
    <path d="M19.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);
export const MuteIcon = () => (
  <svg {...base}>
    <polygon points="4,9 8,9 13,4 13,20 8,15 4,15" fill="currentColor" stroke="none" />
    <line x1="17" y1="9" x2="22" y2="15" />
    <line x1="22" y1="9" x2="17" y2="15" />
  </svg>
);
/*
 * Impostazioni: tre cursori, non un cerchio con i raggi.
 *
 * Il disegno di prima era un sole — cerchio al centro e otto raggi attorno — e
 * questo lettore ha *davvero* un comando per la luminosità: due cose diverse
 * con la stessa figura, una accanto all'altra nella stessa fascia. Tre cursori
 * dicono «qui si regolano delle cose» e non somigliano a nient'altro sulla
 * scena.
 */
export const SettingsIcon = () => (
  <svg {...base}>
    <path d="M4 7h16M4 12h16M4 17h16" />
    <circle cx="9" cy="7" r="1.9" fill="currentColor" />
    <circle cx="15" cy="12" r="1.9" fill="currentColor" />
    <circle cx="8" cy="17" r="1.9" fill="currentColor" />
  </svg>
);
/*
 * Immagine nell'immagine: il riquadro grande centrato nella griglia (prima
 * stava alto, con quattro pixel sopra e sei sotto) e il riquadro piccolo pieno
 * nell'angolo, che è la convenzione che tutti riconoscono.
 */
export const PipIcon = () => (
  <svg {...base}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <rect x="12" y="12" width="7" height="5" rx="1" fill="currentColor" stroke="none" />
  </svg>
);
export const CastIcon = () => (
  <svg {...base}>
    <path d="M3 9V5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-6" />
    <path d="M3 13a7 7 0 0 1 7 7" />
    <path d="M3 17a3 3 0 0 1 3 3" />
    <circle cx="4" cy="20" r="1" fill="currentColor" stroke="none" />
  </svg>
);
export const FullscreenIcon = () => (
  <svg {...base}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" />
    <path d="M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);
export const ExitFullscreenIcon = () => (
  <svg {...base}>
    <path d="M9 3v3a2 2 0 0 1-2 2H4" /><path d="M15 3v3a2 2 0 0 0 2 2h3" />
    <path d="M9 21v-3a2 2 0 0 0-2-2H4" /><path d="M15 21v-3a2 2 0 0 1 2-2h3" />
  </svg>
);
/*
 * Mini player: la freccia è tutta la differenza.
 *
 * Prima era un riquadro con dentro un altro riquadro — cioè la stessa figura
 * dell'immagine nell'immagine, un quadrato invece che un rettangolo. Due
 * comandi diversi, affiancati nella stessa fascia, disegnati uguali: non è che
 * si sbagliasse a premere, è che non c'era niente da capire. La freccia che
 * rientra nell'angolo dice cosa fa: la scena si rimpicciolisce lì.
 */
export const MiniPlayerIcon = () => (
  <svg {...base}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <rect x="12" y="12" width="7" height="5" rx="1" fill="currentColor" stroke="none" />
    <path d="M10 8.5L6.5 12" />
    <path d="M6.5 12h2.6M6.5 12V9.4" />
  </svg>
);
export const CloseIcon = () => (
  <svg {...base}><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></svg>
);
export const ExpandIcon = () => (
  <svg {...base}><polyline points="15,3 21,3 21,9" /><polyline points="9,21 3,21 3,15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
);
export const ErrorIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><circle cx="12" cy="16.3" r="0.6" fill="currentColor" /></svg>
);

// --- Reazioni --------------------------------------------------------------
// Il pollice è disegnato una volta sola e ruotato per il "non fa per me": due
// tracciati speculari divergerebbero al primo ritocco, e sono lo stesso gesto.

const ThumbShape = () => (
  <>
    <path d="M7 10.5v9H4.6A1.6 1.6 0 0 1 3 17.9v-5.8a1.6 1.6 0 0 1 1.6-1.6H7Z" />
    <path d="M7 10.5 11.4 3a2 2 0 0 1 2.9 2.4L13.4 9h5.1a2 2 0 0 1 2 2.5l-1.6 6a2.5 2.5 0 0 1-2.4 1.9H7" />
  </>
);

export const ThumbUpIcon = () => <svg {...base}><ThumbShape /></svg>;

export const ThumbDownIcon = () => (
  <svg {...base}><g transform="rotate(180 12 12)"><ThumbShape /></g></svg>
);

/** "Adoro": due pollici, come il doppio pollice di Netflix. */
export const ThumbUpDoubleIcon = () => (
  <svg {...base} viewBox="0 0 30 24" width={22}>
    <g transform="translate(-1.5 0) scale(0.88) translate(0 1.6)"><ThumbShape /></g>
    <g transform="translate(9.5 0) scale(0.88) translate(0 1.6)"><ThumbShape /></g>
  </svg>
);

// --- Blocco comandi --------------------------------------------------------
export const LockIcon = () => (
  <svg {...base}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" />
  </svg>
);
export const UnlockIcon = () => (
  <svg {...base}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M8 10.5V7.6a4 4 0 0 1 7.6-1.7" />
  </svg>
);

export const BrightnessIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
  </svg>
);

// --- Riga di azioni --------------------------------------------------------
export const ScissorsIcon = () => (
  <svg {...base}>
    <circle cx="6" cy="6" r="2.6" /><circle cx="6" cy="18" r="2.6" />
    <line x1="8.1" y1="7.6" x2="20" y2="18.5" /><line x1="8.1" y1="16.4" x2="20" y2="5.5" />
  </svg>
);
export const SpeedIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 12 15.5 8.5" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);
export const EpisodesIcon = () => (
  <svg {...base}>
    <rect x="8" y="4" width="13" height="12" rx="1.6" />
    <path d="M17 19H5a2 2 0 0 1-2-2V8" />
  </svg>
);
export const SubtitlesIcon = () => (
  <svg {...base}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M6.5 11h4M6.5 14.5h7M14.5 11h3" />
  </svg>
);
export const NextEpisodeIcon = () => (
  <svg {...base}>
    <polygon points="5,4 16,12 5,20" fill="currentColor" stroke="none" />
    <line x1="19" y1="4" x2="19" y2="20" />
  </svg>
);

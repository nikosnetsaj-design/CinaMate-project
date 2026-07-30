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
export const SettingsIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M4 12h2M18 12h2M12 4v2M12 18v2M6.5 6.5l1.4 1.4M16.1 16.1l1.4 1.4M17.5 6.5l-1.4 1.4M7.9 16.1l-1.4 1.4" />
  </svg>
);
export const PipIcon = () => (
  <svg {...base}><rect x="3" y="4" width="18" height="14" rx="1" /><rect x="12" y="11" width="7" height="5" rx="1" fill="currentColor" stroke="none" /></svg>
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
export const MiniPlayerIcon = () => (
  <svg {...base}><rect x="3" y="3" width="18" height="18" rx="1" /><rect x="11" y="12" width="8" height="6" rx="1" /></svg>
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

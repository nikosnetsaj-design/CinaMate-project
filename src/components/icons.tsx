type IconProps = { size?: number };

export function HomeIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 9.5 10 3l7 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8.5V16a1 1 0 0 0 1 1h3v-4.5h2V17h3a1 1 0 0 0 1-1V8.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function CompassIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12.6 7.4 11 11l-3.6 1.6L9 9l3.6-1.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function BookmarkIcon({ size = 18, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M5 3.5h10a.5.5 0 0 1 .5.5v12.4a.4.4 0 0 1-.63.33L10 13.2l-4.87 3.53A.4.4 0 0 1 4.5 16.4V4a.5.5 0 0 1 .5-.5Z" strokeLinejoin="round" />
    </svg>
  );
}

export function BookIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 4.2c1.6-.7 3.6-.7 6 .3v11.3c-2.4-1-4.4-1-6-.3V4.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 4.2c-1.6-.7-3.6-.7-6 .3v11.3c2.4-1 4.4-1 6-.3V4.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function SunIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="3.6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M16.5 12.3A7 7 0 0 1 7.7 3.5a7 7 0 1 0 8.8 8.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.5 13.5 17.5 17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ReelMark({ size = 26 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect width="26" height="26" rx="6" fill="var(--accent)" />
      <circle cx="13" cy="13" r="7.2" fill="none" stroke="var(--accent-contrast)" strokeWidth="1.4" />
      <circle cx="13" cy="6.6" r="1.1" fill="var(--accent-contrast)" />
      <circle cx="18.6" cy="9.8" r="1.1" fill="var(--accent-contrast)" />
      <circle cx="18.6" cy="16.2" r="1.1" fill="var(--accent-contrast)" />
      <circle cx="13" cy="19.4" r="1.1" fill="var(--accent-contrast)" />
      <circle cx="7.4" cy="16.2" r="1.1" fill="var(--accent-contrast)" />
      <circle cx="7.4" cy="9.8" r="1.1" fill="var(--accent-contrast)" />
      <circle cx="13" cy="13" r="2.2" fill="var(--accent-contrast)" />
    </svg>
  );
}

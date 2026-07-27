export function SearchBar({
  value,
  onChange,
  placeholder = "Cerca per titolo o regista…",
  autoFocus = false,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
}) {
  return (
    <div className="relative flex-1">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
      >
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        id={id}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Cerca film"
        className="w-full rounded-sm border border-border-strong bg-surface py-2.5 pl-9 pr-9 text-sm text-text placeholder:text-text-faint focus:border-accent"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Cancella ricerca"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-faint hover:text-text"
        >
          ✕
        </button>
      )}
    </div>
  );
}

import { CloseIcon, SearchIcon } from "./icons";

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
    <div className="relative flex flex-1 items-center">
      <span className="pointer-events-none absolute left-4 text-text-faint">
        <SearchIcon size={18} />
      </span>
      <input
        id={id}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Cerca nella libreria"
        className="field h-11 w-full rounded-full pl-11 pr-12"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Cancella ricerca"
          className="icon-btn icon-btn-sm absolute right-1.5"
        >
          <CloseIcon size={16} />
        </button>
      )}
    </div>
  );
}

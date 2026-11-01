import { useEffect, useRef, useState } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/*
 * I fogli aperti, dall'ultimo in cima. Un foglio sopra un altro — le liste
 * sopra la scheda del titolo, l'importazione sopra le impostazioni — deve
 * prendersi Esc e Tab da solo: prima un Esc chiudeva tutti e due, e chiudere
 * quello sopra rimetteva lo scorrimento alla pagina sotto il foglio rimasto.
 */
const open: symbol[] = [];

export function useFocusTrap(onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [id] = useState(() => Symbol("sheet"));

  useEffect(() => {
    open.push(id);
    previouslyFocused.current = document.activeElement as HTMLElement;
    const first = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    first?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      open.splice(open.indexOf(id), 1);
      if (open.length === 0) document.body.style.overflow = "";
      previouslyFocused.current?.focus();
    };
  }, [id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (open[open.length - 1] !== id) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !containerRef.current) return;
      const focusable = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, id]);

  return containerRef;
}

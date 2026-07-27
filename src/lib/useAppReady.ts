import { useEffect, useState } from "react";

/**
 * Brief, deliberate skeleton window while local state (library + stats) is
 * read and derived, so the first paint never flashes empty content.
 */
export function useAppReady(delayMs = 420): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
  return ready;
}

import { useEffect, useState } from "react";

/**
 * SSR-safe hook that returns whether the given CSS media query currently matches.
 *
 * ```ts
 * const isSmall = useMediaQuery("(max-width: 1100px)");
 * const isShort = useMediaQuery("(max-height: 590px)");
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

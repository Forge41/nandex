"use client";

import { createContext, useContext, useMemo, useState } from "react";

type CitationSelection = {
  selected: number | null;
  toggle: (id: number) => void;
};

const CitationContext = createContext<CitationSelection | null>(null);

/** Shared "which source is selected" state.
 *
 * Citation chips appear in the prose, the probe table and the plan cards, so
 * selecting one has to light up the resume line it came from several levels
 * away. A context avoids threading the pair through every intermediate. */
export function CitationProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<number | null>(null);

  const value = useMemo<CitationSelection>(
    () => ({
      selected,
      toggle: (id) => setSelected((current) => (current === id ? null : id)),
    }),
    [selected]
  );

  return <CitationContext.Provider value={value}>{children}</CitationContext.Provider>;
}

export function useCitationSelection() {
  const value = useContext(CitationContext);
  if (!value) throw new Error("useCitationSelection must be used inside CitationProvider");
  return value;
}

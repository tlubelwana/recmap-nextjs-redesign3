"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AUDIENCE_LENSES, DEFAULT_LENS, getLens, isPersona, type AudienceLens } from "@/lib/audienceLens";
import type { Persona } from "@/lib/db";

/**
 * Holds the audience lens the UI is currently rendering through.
 *
 * Two distinct things are deliberately kept apart:
 *  - `persona` — the audience the user identified as at onboarding, stored
 *    server-side on their account. This is the source of truth and the only
 *    thing that changes what Ask does by default.
 *  - `lens` — the audience the interface is being read through RIGHT NOW.
 *    It starts as the persona, but any user can switch it from the lens bar
 *    without changing their account.
 *
 * The switch is not a gimmick: a guideline developer needs to see what the
 * lived-experience view of their own recommendation looks like, and a policy
 * team needs to see the clinician's. Making that one click away is the point
 * of building the lenses as a layer rather than as four separate apps.
 *
 * A temporary switch persists in localStorage so it survives navigation
 * between tabs, and is cleared by "Reset to my audience". Storage is wrapped
 * because it throws outright in some privacy modes.
 */

const STORAGE_KEY = "recmap.lensOverride";

interface LensContextValue {
  /** The account's saved audience. */
  persona: Persona | null;
  selectedPersonas: Persona[];
  /** The lens currently being rendered through. */
  lens: AudienceLens;
  /** True when the user is previewing a lens that isn't their saved one. */
  isOverridden: boolean;
  setLens: (key: Persona) => void;
  resetLens: () => void;
}

const LensContext = createContext<LensContextValue | null>(null);

function readStoredOverride(): Persona | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isPersona(v) ? v : null;
  } catch {
    return null;
  }
}

export default function LensProvider({
  persona,
  selectedPersonas = persona ? [persona] : [],
  children,
}: {
  persona: Persona | null;
  selectedPersonas?: Persona[];
  children: React.ReactNode;
}) {
  const [override, setOverride] = useState<Persona | null>(null);

  // Read the stored override after mount only: reading localStorage during
  // render would desync server and client HTML on the first paint.
  useEffect(() => {
    const stored = readStoredOverride();
    if (stored && stored !== persona) setOverride(stored);
  }, [persona]);

  const setLens = useCallback(
    (key: Persona) => {
      if (!AUDIENCE_LENSES[key]) return;
      if (key === persona) {
        setOverride(null);
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* private mode — the switch still works for this page load. */
        }
        return;
      }
      setOverride(key);
      try {
        window.localStorage.setItem(STORAGE_KEY, key);
      } catch {
        /* as above */
      }
    },
    [persona]
  );

  const resetLens = useCallback(() => {
    setOverride(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* as above */
    }
  }, []);

  const value = useMemo<LensContextValue>(() => {
    const active = override ?? persona ?? DEFAULT_LENS;
    return {
      persona,
      selectedPersonas,
      lens: getLens(active),
      isOverridden: override !== null && override !== persona,
      setLens,
      resetLens,
    };
  }, [override, persona, selectedPersonas, setLens, resetLens]);

  return <LensContext.Provider value={value}>{children}</LensContext.Provider>;
}

/** Inside the authed app this is always present. Components that can also
 *  render outside it (the Upload success view before a reload, say) get the
 *  default clinician lens rather than a crash. */
export function useAudienceLens(): LensContextValue {
  const ctx = useContext(LensContext);
  if (ctx) return ctx;
  return {
    persona: null,
    selectedPersonas: [],
    lens: getLens(DEFAULT_LENS),
    isOverridden: false,
    setLens: () => undefined,
    resetLens: () => undefined,
  };
}

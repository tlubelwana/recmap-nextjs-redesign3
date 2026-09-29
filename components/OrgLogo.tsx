"use client";

import { useState } from "react";
import { orgInitials } from "@/components/format";

/**
 * An organisation's logo for the "Guidelines referenced" rows, per the v3
 * snapshot.
 *
 * No logo files ship with the app, so this degrades on purpose: it tries
 * public/logos/<slug>.png, then <slug>.svg, and if neither is there it
 * falls back to the organisation's monogram — the same tile the app used
 * everywhere before. Dropping a file into public/logos/ named after the
 * slug is all it takes to light one up; nothing else needs changing.
 *
 * Guideline organisations' logos are their trademarks, so only add files
 * you have the right to display.
 */

export function orgLogoSlug(organization: string): string {
  return organization
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function OrgLogo({
  organization,
  width = 124,
  height = 60,
  fallback = "monogram",
}: {
  organization: string;
  width?: number;
  height?: number;
  /** What to draw when no logo file exists. "monogram" suits rows that
   *  already name the organisation next to the tile; "name" suits catalog
   *  cards, where the logo IS the only organisation label and a two-letter
   *  square would tell the reader nothing. */
  fallback?: "monogram" | "name";
}) {
  const slug = orgLogoSlug(organization);
  const sources = [`/logos/${slug}.png`, `/logos/${slug}.svg`];
  const [sourceIndex, setSourceIndex] = useState(0);

  // Guideline organisations' marks are mostly wordmarks, so the plate is a
  // wide rectangle rather than a square — a square would either crop them
  // or shrink them to illegibility. The monogram fallback stays square,
  // centred in the same footprint.
  if (sourceIndex >= sources.length) {
    if (fallback === "name") {
      return (
        <span className="org-logo org-logo-slot org-logo-name" style={{ width, height }} title={organization}>
          {organization}
        </span>
      );
    }
    return (
      <span className="org-logo org-logo-slot" style={{ width, height }} title={organization}>
        <span className="org-logo-fallback" style={{ width: height, height }}>
          {orgInitials(organization)}
        </span>
      </span>
    );
  }

  return (
    <span className="org-logo org-logo-slot" style={{ width, height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sources[sourceIndex]}
        alt={`${organization} logo`}
        onError={() => setSourceIndex((i) => i + 1)}
      />
    </span>
  );
}

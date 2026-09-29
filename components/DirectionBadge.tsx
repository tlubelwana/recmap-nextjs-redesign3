import { directionLabel, directionVisual } from "@/components/format";
import type { Guideline } from "@/lib/types";

const ICON_PATHS: Record<string, React.ReactNode> = {
  for: <path d="M8 12.5l2.5 2.5L16 9.5" />,
  against: <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />,
  neutral: <path d="M8 12h8" />,
};

export default function DirectionBadge({
  guideline,
}: {
  guideline: Pick<Guideline, "direction" | "directionRaw">;
}) {
  const visual = directionVisual(guideline.direction);
  return (
    <span className={`pill dir-${visual}`}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        {ICON_PATHS[visual]}
      </svg>
      {directionLabel(guideline)}
    </span>
  );
}

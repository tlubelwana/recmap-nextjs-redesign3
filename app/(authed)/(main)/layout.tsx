import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";

/**
 * Nested one level inside app/(authed)/: every page here ALSO requires the
 * user to have picked an audience persona (see app/(authed)/onboarding),
 * which is what lets Map/Ask tailor themselves. /onboarding itself sits
 * outside this group (a sibling under (authed)) specifically so it isn't
 * caught by this redirect — nesting route groups this way avoids needing
 * to detect "am I already on /onboarding" from server-side code, which the
 * App Router doesn't make easy to do reliably.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  // The (authed) layout above already redirects if there's no user at all,
  // but Next re-evaluates layouts independently, so guard again defensively.
  if (!user) redirect("/login");
  if (!user.persona) redirect("/onboarding");
  return <>{children}</>;
}

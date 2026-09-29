import { redirect } from "next/navigation";
import LensProvider from "@/components/LensProvider";
import AppSidebar from "@/components/AppSidebar";
import AppTopBar from "@/components/AppTopBar";
import WelcomeNote from "@/components/WelcomeNote";
import { getCurrentUser } from "@/lib/currentUser";

/**
 * Everything under app/(authed)/ requires a signed-in user. This is a
 * Server Component, so getCurrentUser() (cookies() + node:sqlite) runs in
 * the standard Node.js runtime Next.js uses for Server Components and
 * Route Handlers — there is no Edge-runtime ambiguity to worry about here,
 * which is why this app gates access with a layout rather than
 * middleware.ts (Next's Edge Middleware can't reliably use Node's crypto/fs
 * modules, which lib/auth.ts and lib/db.ts both need).
 *
 * The signed-in user's saved audience is handed to LensProvider here, which
 * is what every client component reads the active lens from — see
 * lib/audienceLens.ts for what a lens actually changes.
 *
 * SHELL (v3): a fixed dark-teal sidebar on the left, and a scrolling
 * content column on the right holding the top bar, the page, and the
 * footer. LensProvider wraps both so the sidebar's audience line and the
 * top bar's lens chip follow whichever lens is active — switching lens
 * should change the whole frame, not just the content area.
 */
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  if (!user) redirect("/login");

  return (
    <LensProvider persona={user.persona} selectedPersonas={user.selectedPersonas}>
      <div className="app-shell">
        <AppSidebar userEmail={user.email} persona={user.persona} />
        <div className="app-column">
          <AppTopBar />
          <main className="main">
            {!user.welcomeSeen && <WelcomeNote />}
            {children}
          </main>
          <footer className="site-footer">
            © 2026 MAGIC Evidence Ecosystem Foundation. All Rights Reserved.
          </footer>
        </div>
      </div>
    </LensProvider>
  );
}

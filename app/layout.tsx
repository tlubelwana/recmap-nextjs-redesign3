import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecMap",
  description:
    "Explore AI-related recommendations across clinical practice guidelines, each appraised with AGREE II.",
};

/**
 * The true top-level shell — deliberately has NO auth check and renders NO
 * nav bar, because /login and /signup live directly under this layout and
 * must render before anyone is signed in. The signed-in app (nav bar
 * included) lives one level down, in app/(authed)/layout.tsx, so every page
 * under app/(authed)/ gets both the auth gate and the nav automatically.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500&family=Newsreader:ital,wght@0,500;0,600;1,500;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

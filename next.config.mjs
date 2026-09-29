import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
const nextConfig = (phase) => ({
  // Keep the dev server's hot-reload files separate from production builds.
  // Running `npm run build` while `npm run dev` is open must not invalidate
  // the chunks that the browser is currently loading.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  // pdf-parse pulls in some Node-only internals; keep it out of the server
  // bundle rather than letting webpack try to trace/bundle it. Next 14.x
  // still has this under `experimental`; on Next 15+ rename this key to the
  // stable top-level `serverExternalPackages`.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
});

export default nextConfig;

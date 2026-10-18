import type { NextConfig } from "next";

/*
 * BUILD_TARGET=pages      → GitHub Pages static export
 *   - output: "export" (pure static files in out/)
 *   - basePath: repo name (Pages serves the site under /<repo>/)
 *   - images unoptimized (no image optimizer on static hosting)
 *   - trailingSlash for directory-style URLs
 * BUILD_TARGET=capacitor  → static export for the Android shell (Capacitor)
 *   - output: "export", NO basePath (served from the WebView root)
 * default                 → standalone Node server (self-host / demo server)
 *
 * distDir is isolated per target so a production build never clobbers
 * the `next dev` server's `.next` directory.
 */
const isPages = process.env.BUILD_TARGET === "pages";
const isCapacitor = process.env.BUILD_TARGET === "capacitor";
const isStatic = isPages || isCapacitor;
const repoName = "Goalcheck";

const nextConfig: NextConfig = isPages
  ? {
      output: "export",
      basePath: `/${repoName}`,
      assetPrefix: `/${repoName}`,
      trailingSlash: true,
      images: { unoptimized: true },
      reactStrictMode: false,
      distDir: ".next-pages",
      env: { NEXT_PUBLIC_GC_BASE_PATH: `/${repoName}` },
    }
  : isCapacitor
    ? {
        output: "export",
        trailingSlash: false,
        images: { unoptimized: true },
        reactStrictMode: false,
        distDir: ".next-capacitor",
      }
    : {
        output: "standalone",
        typescript: {
          ignoreBuildErrors: true,
        },
        reactStrictMode: false,
      };

export default nextConfig;

import type { NextConfig } from "next";

/*
 * BUILD_TARGET=pages  → GitHub Pages static export
 *   - output: "export" (pure static files in out/)
 *   - basePath: repo name (Pages serves the site under /<repo>/)
 *   - images unoptimized (no image optimizer on static hosting)
 *   - trailingSlash for directory-style URLs
 * default            → standalone Node server (self-host / demo server)
 */
const isPages = process.env.BUILD_TARGET === "pages";
const repoName = "Goalcheck";

const nextConfig: NextConfig = isPages
  ? {
      output: "export",
      basePath: `/${repoName}`,
      assetPrefix: `/${repoName}`,
      trailingSlash: true,
      images: { unoptimized: true },
      reactStrictMode: false,
    }
  : {
      output: "standalone",
      typescript: {
        ignoreBuildErrors: true,
      },
      reactStrictMode: false,
    };

export default nextConfig;

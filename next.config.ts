import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // No floating dev badge: it covers the phone tab bar in previews and screenshots.
  devIndicators: false,
  // Next 16 only serves listed qualities: 75 is the default, 90 keeps the hero artwork crisp.
  images: { qualities: [75, 90] },
  partialPrefetching: true,
  turbopack: {
    rules: {
      // Tailwind for plain stylesheets only: CSS modules (the ported Orbit terminal) keep their scoped class names.
      "*.css": {
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

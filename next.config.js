const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // We don't list better-sqlite3 here because we're not using the native addon.
  // Instead, we alias it to a stub via webpack below.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // The official Drizzle better-sqlite3 driver imports `better-sqlite3`
      // at the module level. We alias it to a stub so the module loads without
      // the native addon. At runtime we pass a DatabaseWrapper (wrapping
      // node:sqlite) to drizzle() directly, so the stub's default export
      // (a throwing function) is never called.
      config.resolve.alias = {
        ...config.resolve.alias,
        "better-sqlite3": path.resolve(__dirname, "src/db/better-sqlite3-stub.ts"),
      };
    }
    return config;
  },
};

module.exports = nextConfig;

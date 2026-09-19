/**
 * app.json stays the source of truth (scripts/sync-app-version.mjs rewrites
 * it for releases); this only layers on the one setting that must differ per
 * build.
 *
 * GitHub Pages serves this repo under a subpath
 * (https://campos20.github.io/segue-list/), so the web export has to prefix
 * every bundled resource with it. That is set through EXPO_BASE_URL by
 * .github/workflows/pages.yaml only - baking it into app.json would make
 * `npm run web` serve the dev app from /segue-list instead of the root, and
 * has no meaning for the Android builds.
 */
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL;
  if (!baseUrl) return config;

  return {
    ...config,
    experiments: { ...config.experiments, baseUrl },
  };
};

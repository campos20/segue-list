const { withAppBuildGradle } = require("@expo/config-plugins");

const MARKER = "// segue-list release signing";

/**
 * Appended to the end of android/app/build.gradle rather than patched into
 * the middle of it. `android/` isn't checked in, so this has to survive
 * `expo prebuild` regenerating the file from Expo's template - and appending
 * makes no assumptions about what that template currently looks like, which
 * string-replacing a `signingConfig` line would.
 *
 * Gradle allows the `android { }` extension to be re-opened, so this adds a
 * release signing config without touching anything Expo wrote above it.
 *
 * It only takes effect when all four signing properties are passed in.
 * Without them nothing changes and the build keeps Expo's default signing,
 * so both local builds and CI runs without a keystore configured still
 * work. A *partial* set (e.g. the store file but not its password) fails
 * loudly with a clear message instead of Gradle's opaque "unknown
 * property" error the first time it tries to read a property that was
 * never passed.
 */
const SIGNING_PROPERTIES = [
  "SEGUELIST_STORE_FILE",
  "SEGUELIST_STORE_PASSWORD",
  "SEGUELIST_KEY_ALIAS",
  "SEGUELIST_KEY_PASSWORD",
];

const SIGNING_SNIPPET = `
${MARKER}
def seguelistSigningProps = ${JSON.stringify(SIGNING_PROPERTIES)}
def seguelistSigningPropsPresent = seguelistSigningProps.findAll { project.hasProperty(it) }
if (seguelistSigningPropsPresent.size() == seguelistSigningProps.size()) {
    android {
        signingConfigs {
            release {
                storeFile file(project.property('SEGUELIST_STORE_FILE'))
                storePassword project.property('SEGUELIST_STORE_PASSWORD')
                keyAlias project.property('SEGUELIST_KEY_ALIAS')
                keyPassword project.property('SEGUELIST_KEY_PASSWORD')
            }
        }
        buildTypes {
            release {
                signingConfig signingConfigs.release
            }
        }
    }
} else if (!seguelistSigningPropsPresent.isEmpty()) {
    def missing = seguelistSigningProps - seguelistSigningPropsPresent
    throw new GradleException("Partial release signing configuration: missing \${missing.join(', ')}. Provide all of \${seguelistSigningProps.join(', ')}, or none of them to build with Expo's default signing.")
}
`;

module.exports = function withAndroidSigning(config) {
  return withAppBuildGradle(config, (modConfig) => {
    if (!modConfig.modResults.contents.includes(MARKER)) {
      modConfig.modResults.contents += SIGNING_SNIPPET;
    }
    return modConfig;
  });
};

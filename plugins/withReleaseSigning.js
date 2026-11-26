/**
 * Expo config plugin: signs release builds with your own keystore.
 *
 * Why: `expo prebuild` generates android/app/build.gradle with release builds
 * signed by the *debug* key. A key generated fresh on each CI run would change
 * every build, and Android refuses to install an update signed with a
 * different key (you'd have to uninstall and lose your data). So we sign with
 * a keystore you create once and store in GitHub Secrets.
 *
 * The keystore is read from environment variables at build time, so nothing
 * secret is committed. If LISPO_KEYSTORE_PATH isn't set, it falls back to the
 * debug key (handy for local builds).
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// lispo-release-signing';

const SIGNING_BLOCK = `
        release { ${MARKER}
            if (System.getenv("LISPO_KEYSTORE_PATH")) {
                storeFile file(System.getenv("LISPO_KEYSTORE_PATH"))
                storePassword System.getenv("LISPO_KEYSTORE_PASSWORD")
                keyAlias System.getenv("LISPO_KEY_ALIAS")
                keyPassword System.getenv("LISPO_KEY_PASSWORD")
            }
        }`;

function apply(src) {
  if (src.includes(MARKER)) return src;

  const sc = src.indexOf('signingConfigs {');
  if (sc === -1) throw new Error('withReleaseSigning: signingConfigs block not found in app/build.gradle');
  const insertAt = sc + 'signingConfigs {'.length;
  src = src.slice(0, insertAt) + SIGNING_BLOCK + src.slice(insertAt);

  const bt = src.indexOf('buildTypes {');
  const rel = src.indexOf('release {', bt);
  const target = 'signingConfig signingConfigs.debug';
  const at = src.indexOf(target, rel);
  if (bt === -1 || rel === -1 || at === -1) throw new Error('withReleaseSigning: release buildType signingConfig not found');
  const replacement = 'signingConfig System.getenv("LISPO_KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug';
  return src.slice(0, at) + replacement + src.slice(at + target.length);
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') throw new Error('withReleaseSigning expects a Groovy build.gradle');
    cfg.modResults.contents = apply(cfg.modResults.contents);
    return cfg;
  });
};

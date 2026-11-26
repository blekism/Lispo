// Extends app.json. CI passes LISPO_VERSION_CODE (the workflow run number) so
// every APK has a higher versionCode than the last and installs as an update.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    versionCode: Number(process.env.LISPO_VERSION_CODE || config.android.versionCode || 1),
  },
});

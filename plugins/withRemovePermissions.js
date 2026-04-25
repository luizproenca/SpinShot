const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS_TO_REMOVE = [
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
];

module.exports = function withRemovePermissions(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;

    if (manifest['uses-permission']) {
      manifest['uses-permission'] = manifest['uses-permission'].filter((permission) => {
        const name = permission.$['android:name'];
        return !PERMISSIONS_TO_REMOVE.includes(name);
      });
    }

    if (manifest['uses-permission-sdk-23']) {
      manifest['uses-permission-sdk-23'] = manifest['uses-permission-sdk-23'].filter((permission) => {
        const name = permission.$['android:name'];
        return !PERMISSIONS_TO_REMOVE.includes(name);
      });
    }

    return config;
  });
};
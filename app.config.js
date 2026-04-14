const versionData = require('./version.json');

module.exports = {
  expo: {
    name: 'SpinShot',
    slug: 'spinshot',
    version: versionData.version,

    ios: {
      buildNumber: String(versionData.build), // iOS precisa ser string
      bundleIdentifier: 'com.ironman.spinshot.app',
      supportsTablet: true,
      infoPlist: {
        UIStatusBarStyle: 'UIStatusBarStyleLightContent',
      },
    },

    android: {
      versionCode: versionData.build, // Android precisa ser number
      package: 'com.ironman.spinshot.app',
      adaptiveIcon: {
        foregroundImage: './assets/images/logo.png',
        backgroundColor: '#000000',
      },
      edgeToEdgeEnabled: true,
    },

    // resto igual...
  },
};
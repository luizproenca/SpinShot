const versionData = require('./version.json');

module.exports = {
  expo: {
    name: 'SpinShot',
    slug: 'spinshot',
    version: versionData.version,
    icon: './assets/images/icon.png',
    orientation: 'portrait',
    scheme: 'onspaceapp',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    ios: {
      appleTeamId: 'Q6943C4X4V',
      usesNonExemptEncryption: false,
      supportsTablet: true,
      bundleIdentifier: 'com.ironman.spinshot.app',
      buildNumber: String(versionData.build),
      infoPlist: {
        UIStatusBarStyle: 'UIStatusBarStyleLightContent',
      },
    },
    android: {
      package: 'com.ironman.spinshot.app',
      versionCode: versionData.build,
      adaptiveIcon: {
        foregroundImage: './assets/images/logo.png',
        backgroundColor: '#000000',
      },
      edgeToEdgeEnabled: true,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/logo.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/logo.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#1A1740',
        },
      ],
      'expo-web-browser',
      '@react-native-community/datetimepicker',
      'expo-asset',
      'expo-audio',
      'expo-font',
      'expo-localization',
      'expo-mail-composer',
      'expo-secure-store',
      'expo-sqlite',
      'expo-video',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      cloudinaryCloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
    },
  },
};
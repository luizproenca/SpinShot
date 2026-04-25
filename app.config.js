const versionData = require('./version.json');

module.exports = {
  expo: {
    name: 'SpinShot',
    slug: 'spinshot',
    version: versionData.version,
    icon: './assets/images/icon.png',
    orientation: 'portrait',
    scheme: 'spinshot',
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
        CFBundleAllowMixedLocalizations: true,
        NSCameraUsageDescription: "O SpinShot 360 usa a câmera para gravar vídeos 360, boomerangs e vídeos cinemáticos dentro dos eventos criados no app, por exemplo ao capturar um vídeo com moldura e música para compartilhar ou salvar no celular.",
        NSMicrophoneUsageDescription: "O SpinShot 360 usa o microfone para gravar o áudio dos vídeos capturados no app, por exemplo quando você cria um vídeo 360 ou boomerang com som ambiente durante um evento.",
        NSPhotoLibraryUsageDescription: "O SpinShot 360 acessa a biblioteca de fotos para permitir que você selecione mídias do dispositivo, por exemplo ao escolher uma imagem, vídeo ou arquivo visual para usar em um evento, composição ou personalização do conteúdo.",
        NSPhotoLibraryAddUsageDescription: "O SpinShot 360 salva vídeos e imagens gerados no app na sua biblioteca de fotos, por exemplo quando você exporta um vídeo finalizado para guardar no celular ou compartilhar."
      
      },
    },
    android: {
      package: 'com.ironman.spinshot.app',
      versionCode: versionData.build,
      adaptiveIcon: {
        foregroundImage: './assets/images/icon.png',
        backgroundColor: '#000000',
      },
      edgeToEdgeEnabled: true,
      blockedPermissions: [
                  "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.READ_CALENDAR",
        "android.permission.WRITE_CALENDAR",
        "android.permission.READ_CONTACTS",
        "android.permission.WRITE_CONTACTS",
        "android.permission.USE_BIOMETRIC",
        "android.permission.USE_FINGERPRINT",
        "android.permission.READ_PHONE_STATE",
        "android.permission.ACTIVITY_RECOGNITION",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
      ]
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
      'expo-font',
      'expo-localization',
      'expo-mail-composer',
      'expo-secure-store',
      'expo-sqlite',
      'expo-video',
      './plugins/withRemovePermissions',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      cloudinaryCloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
      eas: {
        projectId: "ef042039-232a-4f01-ab82-be7cb15c76e9"
      }  
    },

    locales: {
      pt: './locales/pt.json',
      en: './locales/en.json',
      es: './locales/es.json'
    },
   
  },
};
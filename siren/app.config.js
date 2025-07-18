export default {
  expo: {
    name: "SirenNotifyTest",
    slug: "siren",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "siren",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.sirennotify.myapp",
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.sirennotify.myapp",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      googleServicesFile: "./google-services.json",
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "@react-native-google-signin/google-signin",
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      firebaseApiKey: "AIzaSyDARmfCcYMnr662saaNnUIc8fG0hv84QHg",
      router: {},
      eas: {
        projectId: "d99fdd21-0e1e-426c-a598-ee08cc93f8d3",
      },
    },
    owner: "gkhoury17",
  },
};

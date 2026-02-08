import type { CapacitorConfig } from '@capacitor/cli';

// ═══════════════════════════════════════════════════════════════
// LIVE RELOAD AYARLARI
// ═══════════════════════════════════════════════════════════════
// Development modunda otomatik yenileme için:
// 1. Aşağıdaki USE_LIVE_RELOAD'ı true yapın
// 2. DEV_SERVER_URL'i bilgisayarınızın IP adresi ile güncelleyin (ipconfig ile öğrenebilirsiniz)
// 3. npm run dev:android komutunu çalıştırın
// 4. Android Studio'da uygulamayı çalıştırın
// 5. Değişiklikler otomatik olarak uygulamada görünecek!

const USE_LIVE_RELOAD = false; // false yaparsanız production moduna geçer
const DEV_SERVER_URL = 'http://192.168.0.230:5173'; // IP adresinizi buraya yazın

const config: CapacitorConfig = {
  appId: 'com.nicebase.app',
  appName: 'NICEBASE',
  webDir: 'dist',
  server: USE_LIVE_RELOAD ? {
    url: DEV_SERVER_URL,
    cleartext: true, // HTTP için gerekli
  } : {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#FF6B35',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#ffffff',
    },
  },
};

export default config;

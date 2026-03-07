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

// Live reload ayarları - environment variable'dan oku, yoksa default değerleri kullan
const USE_LIVE_RELOAD = process.env.CAPACITOR_USE_LIVE_RELOAD === 'true' || false;
// 10.0.2.2 = Android emülatöründen host makinenin localhost'u
// Gerçek cihaz kullanıyorsan: CAPACITOR_DEV_SERVER_URL=http://192.168.x.x:5173 npm run dev:emulator
const DEV_SERVER_URL = process.env.CAPACITOR_DEV_SERVER_URL || 'http://10.0.2.2:5173';

const config: CapacitorConfig = {
  appId: 'com.nicebase.app',
  appName: 'NICEBASE',
  webDir: 'dist',
  server: USE_LIVE_RELOAD ? {
    url: DEV_SERVER_URL,
    cleartext: true, // HTTP için gerekli
  } : {
    androidScheme: 'https',
    iosScheme: 'com.nicebase.app',
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
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'dark',
      backgroundColor: '#ffffff',
    },
    SocialLogin: {
      providers: {
        google: true,
        apple: false,
        facebook: false,
        twitter: false,
      },
    },
  },
};

export default config;

# 🔄 Live Reload Kullanım Kılavuzu

## Otomatik Değişiklik Uygulama (Live Reload)

Android uygulamasında değişikliklerin otomatik olarak görünmesi için:

### 1. IP Adresinizi Öğrenin
```bash
ipconfig
```
Çıktıdan `IPv4 Address` değerini kopyalayın (örn: `192.168.0.230`)

### 2. Capacitor Config'i Güncelleyin
`capacitor.config.ts` dosyasını açın ve:
- `USE_LIVE_RELOAD = true` olduğundan emin olun
- `DEV_SERVER_URL` değerini IP adresinizle güncelleyin:
  ```typescript
  const DEV_SERVER_URL = 'http://192.168.0.230:5173'; // IP'nizi buraya yazın
  ```

### 3. Dev Server'ı Başlatın
```bash
npm run dev:android
```
Bu komut Vite dev server'ı başlatır ve değişiklikleri izler.

### 4. Android Studio'da Sync Edin
```bash
npm run cap:sync
```

### 5. Uygulamayı Çalıştırın
Android Studio'da uygulamayı çalıştırın veya:
```bash
npm run cap:run:android
```

### 6. Artık Otomatik Yenileniyor! 🎉
- Kod değişiklikleriniz otomatik olarak uygulamada görünecek
- Sayfayı yenilemenize gerek yok
- Hot Module Replacement (HMR) aktif

## Production Moduna Geçiş

Production build için:
1. `capacitor.config.ts`'de `USE_LIVE_RELOAD = false` yapın
2. `npm run build` çalıştırın
3. `npm run cap:sync` ile sync edin

## Sorun Giderme

### Uygulama bağlanamıyor
- Bilgisayarınız ve telefonunuz aynı WiFi ağında olmalı
- Firewall'ın 5173 portunu engellemediğinden emin olun
- IP adresinin doğru olduğundan emin olun

### Değişiklikler görünmüyor
- Dev server'ın çalıştığından emin olun (`npm run dev:android`)
- Android Studio'da uygulamayı yeniden başlatın
- `capacitor.config.ts`'de `USE_LIVE_RELOAD = true` olduğundan emin olun

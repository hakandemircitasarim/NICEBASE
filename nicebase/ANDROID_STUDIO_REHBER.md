# Android Studio'da Test Etme Rehberi

## Hızlı Başlangıç

### 1. Build ve Sync (İlk Sefer)

```bash
# Web build yap
npm run build

# Capacitor sync (web dosyalarını Android'e kopyala)
npm run cap:sync
```

### 2. Android Studio'yu Aç

**Yöntem 1: Komut ile (Önerilen)**
```bash
npm run cap:open:android
```

**Yöntem 2: Manuel**
1. Android Studio'yu aç
2. `File → Open`
3. `nicebase/android` klasörünü seç
4. `OK` tıkla

### 3. Android Studio'da İlk Kurulum

1. **Gradle Sync**: Android Studio açıldığında otomatik başlar. Bitmesini bekle.
2. **SDK Kontrolü**: 
   - `File → Settings → Appearance & Behavior → System Settings → Android SDK`
   - Android SDK Platform 24+ yüklü olmalı
   - Android SDK Build-Tools yüklü olmalı

### 4. Emülatör veya Fiziksel Cihaz

**Emülatör:**
1. `Tools → Device Manager`
2. `Create Device` → Bir cihaz seç (örn: Pixel 5)
3. Sistem görüntüsü seç (API 24+)
4. `Finish`

**Fiziksel Cihaz:**
1. Telefonda: `Ayarlar → Geliştirici Seçenekleri → USB Debugging` aç
2. USB ile bağla
3. Android Studio'da cihaz görünecek

### 5. Uygulamayı Çalıştır

1. Üstteki cihaz seçiciden emülatör/cihaz seç
2. Yeşil ▶️ (Run) butonuna tıkla
3. Veya `Shift + F10` (Windows) / `Ctrl + R` (Mac)

### 6. Geliştirme Sırasında

Her değişiklikten sonra:

```bash
# Web build
npm run build

# Sync
npm run cap:sync
```

Sonra Android Studio'da tekrar ▶️ (Run) yap.

**Not:** Android Studio açıkken sync yaptıysan, Android Studio'da "Sync Now" butonuna tıklayabilirsin.

## Sorun Giderme

### "SDK location not found"
- `android/local.properties` dosyası oluştur:
```
sdk.dir=C\:\\Users\\[KULLANICI_ADI]\\AppData\\Local\\Android\\Sdk
```

### Build hatası
- `Build → Clean Project`
- `Build → Rebuild Project`

### Gradle sync hatası
- `File → Invalidate Caches → Invalidate and Restart`

### Uygulama açılmıyor
- Logcat'te hataları kontrol et: `View → Tool Windows → Logcat`

## Debugging

1. **Logcat**: `View → Tool Windows → Logcat`
2. **Breakpoints**: Kod satırının yanına tıkla (kırmızı nokta)
3. **Debug Mode**: Yeşil böcek 🐛 ikonuna tıkla (Run yerine)

## APK Oluşturma (Test İçin)

1. `Build → Build Bundle(s) / APK(s) → Build APK(s)`
2. APK: `android/app/build/outputs/apk/debug/app-debug.apk`
3. Bu APK'yı telefona kopyalayıp yükleyebilirsin

## Önemli Notlar

- İlk açılışta Gradle indirmeleri uzun sürebilir (internet gerekli)
- Android Studio'da proje açıkken, web tarafında değişiklik yapıp `npm run build && npm run cap:sync` yapmalısın
- Hot reload yok, her değişiklikten sonra rebuild gerekli

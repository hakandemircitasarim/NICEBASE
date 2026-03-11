# NICEBASE — Google Play Store Hazırlık Planı

3 paralel denetimden (UI/UX, Android/Capacitor, Güvenlik/Performans) çıkan
tüm bulgular birleştirilmiştir. Adımlar öncelik sırasına göre dizilmiştir.

---

## ADIM 1: Cleartext HTTP Güvenlik Açığını Kapat (CRITICAL)

**Dosya:** `android/app/src/main/res/xml/network_security_config.xml`

Şu an `cleartextTrafficPermitted="true"` ile 10.0.2.2'ye HTTP izni var.
Bu Play Store tarafından reddedilme sebebi.

**Yapılacak:** Cleartext satırını kaldır, boş config bırak.

---

## ADIM 2: allowBackup="false" Yap (HIGH)

**Dosya:** `android/app/src/main/AndroidManifest.xml`

`android:allowBackup="true"` → auth token'lar ve kişisel veriler
Google Cloud'a yedeklenebilir. Güvenlik riski.

**Yapılacak:** `android:allowBackup="false"` olarak değiştir.

---

## ADIM 3: Console.log/warn Temizliği (HIGH)

**14 dosyada toplam 59 adet** `console.log` ve `console.warn` var.

En kritikler:
- `src/pages/Aiya.tsx` (13 adet) — AI chat debug logları
- `src/hooks/useOAuth.ts` (7 adet) — OAuth token'ları loglanıyor!
- `src/store/useStore.ts` (7 adet)
- `src/services/memoryService.ts` (6 adet)
- `src/services/aiyaService.ts` (6 adet)
- `src/utils/registerSW.ts` (5 adet)
- `src/utils/capacitor.ts` (4 adet)
- `src/services/errorLoggingService.ts` (3 adet)
- `src/services/performanceService.ts` (2 adet)
- `src/utils/localUserId.ts` (2 adet)
- `src/lib/supabase.ts` (1 adet)
- `src/pages/Login.tsx` (1 adet)
- `src/components/ErrorBoundary.tsx` (1 adet)
- `src/components/RouteErrorBoundary.tsx` (1 adet)

**Yapılacak:** Her dosyada:
- Debug amaçlı `console.log` → `if (import.meta.env.DEV)` ile sar
- `console.error` → errorLoggingService'e yönlendir (kalabilir)
- OAuth token loglayan satırlar → tamamen kaldır

---

## ADIM 4: Hardcoded Türkçe Fallback Metinleri (HIGH)

30+ yerde `defaultValue: 'Türkçe metin'` veya `|| 'Türkçe metin'` pattern'ı var.
İngilizce kullanıcıda Türkçe metin görünür.

**Dosyalar ve örnekler:**
- `src/pages/Home.tsx` — ~20 adet hardcoded (günaydın, iyi geceler, anı, vb.)
- `src/pages/RelationshipSaver.tsx` — ~12 adet (şimdi göster, paylaşıldı, vb.)
- `src/pages/Achievements.tsx` — ~6 adet (rozetler, başarımlar)
- `src/pages/Statistics.tsx` — ~4 adet (istatistikler)

**Yapılacak:** Her hardcoded metni i18n key'e çevir, hem TR hem EN ekle.

---

## ADIM 5: Capacitor Live Reload Güvenliği (MEDIUM)

**Dosya:** `capacitor.config.ts`

`CAPACITOR_USE_LIVE_RELOAD=true` olursa production'da `http://10.0.2.2:5173`'e
bağlanmaya çalışır → app çöker.

**Yapılacak:** Production build'de bu env var'ın aktif olamayacağını garanti
eden bir kontrol ekle.

---

## ADIM 6: Aiya Chat — Loading/Error State İyileştirmesi (MEDIUM)

**Dosya:** `src/pages/Aiya.tsx`

- Mesaj gönderirken input alanı aktif kalıyor (çift gönderim riski)
- Chat yükleme hatalarında sadece toast var, kalıcı error state yok
- Sync hataları sessizce yutulabiliyor

**Yapılacak:**
- Send butonuna loading/disabled state ekle
- Chat yükleme hatası için retry UI ekle

---

## ADIM 7: Vault Filtre Boş State (MEDIUM)

**Dosya:** `src/pages/Vault.tsx`

Filtreler uygulandığında sonuç yoksa kullanıcı boş ekran görüyor.
Filtrelere özel "Bu filtrelerle sonuç bulunamadı" mesajı eksik.

**Yapılacak:** Filtre sonucu boşsa i18n destekli mesaj göster.

---

## ADIM 8: Image Fallback Tutarsızlıkları (MEDIUM)

- `src/pages/Home.tsx` (line ~546): onError handler resmi gizliyor ama placeholder yok
- `src/pages/RelationshipSaver.tsx` (fullscreen mode): `loading="lazy"` var ama onError yok

**Yapılacak:** Tüm `<img>` tag'lerine tutarlı onError + placeholder SVG ekle.

---

## ADIM 9: Eksik Aria-Label'lar (LOW-MEDIUM)

Erişilebilirlik açısından bazı interaktif elementlerde aria-label eksik:
- Home.tsx: daily question answered badge
- RelationshipSaver.tsx: pagination counter

**Yapılacak:** Tüm tıklanabilir/interaktif elementlere aria-label ekle.

---

## ADIM 10: ResetPassword Spinner (LOW)

**Dosya:** `src/pages/ResetPassword.tsx`

Loading state'te sadece text değişiyor ("Güncelleniyor..."), spinner yok.
Diğer sayfalarda LoadingSpinner kullanılıyor.

**Yapılacak:** LoadingSpinner component'ini ekle, tutarlılık sağla.

---

## ADIM 11: Build & Final Test (ZORUNLU — Son Adım)

1. `npm run build` → TypeScript hatası olmadığını doğrula
2. `npm run test` → Testler geçiyor mu kontrol et
3. Production APK build → `npx cap sync android && cd android && ./gradlew assembleRelease`
4. Fiziksel cihazda test

---

## KAPSAM DIŞI (Bu Plana Dahil Değil)

Bu maddeler önemli ama ayrı bir çalışma gerektirir:

| Madde | Neden Kapsam Dışı |
|-------|-------------------|
| OpenAI API Key'i backend'e taşıma | Backend altyapısı gerektirir (Supabase Edge Functions). Ayrı plan. |
| Release keystore oluşturma | Kullanıcının kendi makinesinde yapması gereken fiziksel işlem |
| google-services.json (Firebase) | Firebase Console'da proje oluşturma gerekli |
| Play Store listing (screenshot, açıklama) | Tasarım ve içerik çalışması |
| Privacy Policy sayfası | Yasal metin yazımı gerekli |

---

## ÖZET TABLO

| Adım | Öncelik | Dosya Sayısı | Tahmini Zorluk |
|------|---------|-------------|----------------|
| 1. Cleartext HTTP | CRITICAL | 1 | Kolay |
| 2. allowBackup | HIGH | 1 | Kolay |
| 3. Console temizliği | HIGH | 14 | Orta |
| 4. Hardcoded Türkçe | HIGH | 4+ i18n.ts | Orta-Zor |
| 5. Live reload guard | MEDIUM | 1 | Kolay |
| 6. Aiya states | MEDIUM | 1 | Orta |
| 7. Vault filter empty | MEDIUM | 1 | Kolay |
| 8. Image fallbacks | MEDIUM | 2 | Kolay |
| 9. Aria labels | LOW-MEDIUM | 2 | Kolay |
| 10. Reset spinner | LOW | 1 | Kolay |
| 11. Build & test | ZORUNLU | - | - |

# Add Memory (Anı Ekle) – QA / Test Matrisi

Bu doküman `Anı Ekle` akışının web + native (Capacitor iOS/Android) için manuel test checklist’idir.

## Hedef davranış (özet)
- **Hibrit yüzey**:
  - **Native (iOS/Android)**: tam ekran (`/add-memory`)
  - **Web/desktop**: modal (`MemoryForm` → `ModalShell`)
- **Scroll**: sadece form içeriği kayar (**inner scroll**), arka plan kilitlenir.
- **Kritik regresyon**: “Tarih görünüyor ama altındaki alanlar yok” (scroll çalışmıyor) asla geri gelmemeli.
- **Offline-first premium sync**:
  - Anı offline iken **local DB’ye kaydedilir** ve listede görünür.
  - Online olunca **otomatik sync** kuyruğu boşaltır (Settings’e girmeden).
  - Fotoğraflar cloud’a **Supabase Storage** ile upload edilir; `memories.photos` alanında sadece **URL** olur.
  - Conflict’te yerel kayıp yok: anı `conflict` badge alır.

---

## A) Web / Desktop (Chrome, Edge)

### A1) Temel modal davranışı
- [ ] `Home` → “+” / “Anı Ekle” tetikle (webde modal açılmalı)
- [ ] Arka plan **kaymıyor** (scroll lock çalışıyor)
- [ ] Modal içeriği **kayabiliyor** (mouse wheel + trackpad)
- [ ] `ESC` modalı kapatıyor
- [ ] Kapatınca fokus (modalı açan butona) geri dönüyor

### A2) İçerik kaydırma regresyon testi (kritik)
- [ ] “Detaylı / Advanced” aç
- [ ] “Tarih” alanını gör
- [ ] Aşağı kaydırınca şu alanlar görünür:
  - [ ] “Bağlantılar (connections)”
  - [ ] “Yaşam alanı (lifeArea)”
  - [ ] “Çekirdek anı (coreMemory)”

### A3) Form doğrulama
- [ ] Boş metinle Kaydet → hata gösteriyor
- [ ] < 10 karakter Kaydet → hata gösteriyor
- [ ] Gelecek tarih seçmeye çalış → hata / engel

### A4) Fotoğraf
- [ ] “Fotoğraf ekle” → Galeri seçiminde dosya seçebiliyorsun
- [ ] Upload sırasında UI kilidi/skeleton görünüyor
- [ ] 5 fotoğraf sonrası limit mesajı çıkıyor

---

## B) Web – Device Emülasyonu (Chrome DevTools)

### B1) iPhone/Android preset
- [ ] Viewport daraltınca modal “bottom-sheet hissi” korunuyor
- [ ] İçerik **kayabiliyor** (wheel + touch drag)
- [ ] Metin alanına otomatik odak geliyor ve alan görünür kalıyor

Not: Device emülasyonu “touch” gibi görünse bile **web** sayılır; scroll lock davranışı web’e göre olmalı.

---

## C) Native (Capacitor iOS / Android)

### C1) Yüzey ve navigation
- [ ] `Home` → “Anı Ekle” tetikle → `/add-memory` tam ekran açılmalı
- [ ] Bottom nav gizli kalmalı (AddMemory ekranında)
- [ ] Geri (Android back / iOS back gesture) kapatmalı

### C2) Scroll & keyboard
- [ ] Arka plan kaymıyor (background locked)
- [ ] Form içeriği kayıyor (iOS bounce olmadan)
- [ ] Klavye açılınca CTA erişilebilir kalıyor (footer safe-area + içerik kaydırma)

### C3) A11y / input
- [ ] Metin alanı odaklanınca görünür alanda kalıyor
- [ ] Fotoğraf ekle (kamera/galeri) düzgün çalışıyor (platforma göre)

---

## D) Regression Spot-Checks

Her release öncesi hızlı kontrol:
- [ ] “Tarih altı alanlar” kaydırarak erişilebilir
- [ ] `Select` aç/kapat (lifeArea) sonrası ana form scroll’u bozulmuyor
- [ ] Modal kapat/aç tekrarında scroll çalışıyor

---

## E) Offline Sync (Premium) – Kritik Senaryolar

> Not: Foto upload için Supabase Storage bucket gerekir. Varsayılan bucket adı: `memory-photos`.\n> İstersen `.env` ile `VITE_SUPABASE_PHOTO_BUCKET` set edebilirsin.

### E1) Offline create → online otomatik sync
- [ ] İnterneti kapat (uçak modu)\n- [ ] Yeni anı kaydet\n- [ ] Listede anı görünüyor ve kartta “Senkron bekliyor” rozeti var\n- [ ] İnterneti aç\n- [ ] 1 dakika içinde rozet kayboluyor (otomatik sync)\n- [ ] Settings → Data → Sync panelinde pending 0’a iner

### E2) Offline create + foto → online Storage upload
- [ ] İnterneti kapat\n- [ ] Fotoğraf ekleyerek yeni anı kaydet\n- [ ] Anı listede görünür\n- [ ] İnterneti aç\n- [ ] Sync sonrası:\n  - [ ] Fotoğraf görüntülenmeye devam eder\n  - [ ] (Opsiyonel kontrol) `memories.photos` artık http(s) URL (data URL değil)\n
### E3) Conflict senaryosu (yerel kayıp yok)
- [ ] Cihaz A: offline (internet kapalı)\n- [ ] Cihaz B: online\n- [ ] Aynı anıyı B’de düzenle ve kaydet\n- [ ] A’da aynı anıyı düzenle ve kaydet (local unsynced)\n- [ ] A internete bağlanınca:\n  - [ ] Anı “Çakışma” rozeti alır\n  - [ ] Yerel metin kaybolmaz\n  - [ ] Settings → Sync panelinde conflict sayısı artar



# CLAUDE.md — AI Asistan Kuralları

Bu dosya, bu projede çalışan her AI asistanın (Claude, Cursor, Copilot, vb.)
**her konuşma başlangıcında** okuması ve uyması gereken kurallardır.

Kuralları çiğnemek = production'da patlama. Kurallar tartışılmaz.

---

## PROJE HAKKINDA

**NICEBASE** — Duygu ve anı takip uygulaması. Kullanıcılar günlük
anılarını (memory) kaydeder, AI ile analiz eder, bağlantılarını (kişi, yer,
nesne) yönetir ve istatistiklerini görüntüler. Offline-first mimari ile
internet olmadan da çalışır.

**Uygulama türü:** React SPA + Capacitor (Web, Android, iOS)

---

## TEKNOLOJİ STACK'İ

| Katman | Teknoloji | Versiyon |
|--------|-----------|----------|
| **Frontend** | React + TypeScript | React 19, TS 5.9 |
| **Build** | Vite | 7.2 |
| **Stil** | Tailwind CSS | 3.4 |
| **State** | Zustand | 5.0 |
| **Data Fetching** | TanStack React Query | 5.90 |
| **Animasyon** | Framer Motion | 12.x |
| **i18n** | i18next + react-i18next | 25.x |
| **Backend** | Supabase (Auth, DB, Storage) | 2.87 |
| **Local DB** | Dexie.js (IndexedDB) | 4.2 |
| **Mobil** | Capacitor | 8.0 |
| **AI** | OpenAI API | 6.10 |
| **Charts** | Recharts | 3.5 |
| **Icons** | Lucide React | 0.561 |
| **Toast** | react-hot-toast | 2.6 |
| **PDF** | jsPDF + jspdf-autotable | 3.0 |
| **Test** | Vitest + Testing Library | 4.0 |
| **PWA** | vite-plugin-pwa + Workbox | 1.2 |

---

## TEMEL KOMUTLAR

```bash
# Geliştirme
cd nicebase && npm run dev          # Vite dev server (port 5173)

# Build & Test
npm run build                       # TypeScript + Vite production build
npm run test                        # Vitest unit tests
npm run test:watch                  # Vitest watch mode

# Mobil
npm run cap:sync                    # Capacitor sync (Android)
npm run cap:open:android            # Android Studio aç
npm run cap:run:android             # Android'de çalıştır

# Supabase (Local)
npm run supabase:start              # Local Supabase Docker
npm run supabase:stop               # Docker durdur
npm run supabase:status             # Durum kontrolü
npm run db:publish                  # Migration çalıştır

# Yardımcı
npm run doctor                      # Ortam doğrulama
npm run generate:icons              # İkon üretimi
```

> **Not:** Tüm komutlar `nicebase/` dizininde çalıştırılmalıdır.

---

## DİZİN YAPISI

```
nicebase/
├── src/
│   ├── pages/                  # Sayfa component'leri (11 route, lazy-loaded)
│   │   ├── Home.tsx            # Ana sayfa / dashboard
│   │   ├── Vault.tsx           # Anı kasası (arama, filtre)
│   │   ├── AddMemory.tsx       # Yeni anı oluşturma
│   │   ├── RelationshipSaver.tsx # Bağlantı bazlı anı slaytları
│   │   ├── Aiya.tsx            # AI sohbet arayüzü
│   │   ├── Statistics.tsx      # İstatistikler ve grafikler
│   │   ├── Achievements.tsx    # Rozetler ve başarılar
│   │   ├── Profile.tsx         # Kullanıcı profili ve ayarlar
│   │   ├── Connections.tsx     # Bağlantı yönetimi (kişi/yer/nesne/proje)
│   │   ├── Login.tsx           # Giriş sayfası
│   │   └── ResetPassword.tsx   # Şifre sıfırlama
│   │
│   ├── components/             # Tekrar kullanılan UI (43 dosya)
│   │   ├── Layout.tsx          # Ana layout wrapper
│   │   ├── MemoryForm.tsx      # Anı formu (ana)
│   │   ├── MemoryCard.tsx      # Anı kartı
│   │   ├── ErrorBoundary.tsx   # Hata yakalama
│   │   ├── OfflineIndicator.tsx # Çevrimdışı göstergesi
│   │   └── ...                 # Diğer UI bileşenleri
│   │
│   ├── services/               # İş mantığı katmanı (15 dosya)
│   │   ├── memoryService.ts    # Anı CRUD (IndexedDB + sync queue)
│   │   ├── memorySyncService.ts # Offline-first senkronizasyon (5dk aralık)
│   │   ├── photoStorageService.ts # Fotoğraf upload/download (Supabase Storage)
│   │   ├── aiyaService.ts      # AI sohbet (OpenAI via Edge Function)
│   │   ├── gamificationService.ts # Rozet ve başarı hesaplama
│   │   ├── streakService.ts    # Seri hesaplama
│   │   ├── dailyQuestionService.ts # Günlük soru
│   │   ├── notificationService.ts # Push/local bildirimler
│   │   ├── exportService.ts    # PDF export
│   │   ├── errorLoggingService.ts # Hata loglama
│   │   ├── performanceService.ts # Performans izleme
│   │   ├── syncQueueHelper.ts  # Sync queue yönetimi (v2, dedup, retry)
│   │   └── __tests__/          # Servis testleri
│   │
│   ├── hooks/                  # Custom React hook'lar (14 dosya)
│   │   ├── useMemories.ts      # Anı yükleme
│   │   ├── useOAuth.ts         # Google OAuth (native + web)
│   │   ├── useMemoryFilters.ts # Filtreleme state'i
│   │   ├── useVoiceInput.ts    # Sesle yazma (Web Speech API)
│   │   ├── useLongPress.ts     # Uzun basma jest'i
│   │   ├── useSwipe.ts         # Kaydırma jest'i
│   │   ├── usePullToRefresh.ts # Çekerek yenileme
│   │   └── ...                 # Diğer hook'lar
│   │
│   ├── lib/                    # Core kütüphaneler (5 dosya)
│   │   ├── supabase.ts         # Supabase client init
│   │   ├── db.ts               # Dexie IndexedDB şeması (v3)
│   │   ├── userService.ts      # Kullanıcı profil yönetimi
│   │   ├── memoryMapper.ts     # snake_case ↔ camelCase (memory)
│   │   └── userMapper.ts       # snake_case ↔ camelCase (user)
│   │
│   ├── store/
│   │   └── useStore.ts         # Zustand global state (user, theme, lang, online)
│   │
│   ├── types/                  # TypeScript tipleri
│   │   ├── index.ts            # Memory, User, Connection, vb.
│   │   ├── supabase.ts         # Supabase şema tipleri
│   │   └── capacitor.ts        # Capacitor plugin arayüzleri
│   │
│   ├── utils/                  # Yardımcı fonksiyonlar (20 dosya)
│   │   ├── capacitor.ts        # Platform algılama
│   │   ├── retry.ts            # Exponential backoff retry
│   │   ├── sanitize.ts         # XSS önleme
│   │   ├── formValidation.ts   # Form doğrulama kuralları
│   │   ├── imageUtils.ts       # Resim sıkıştırma
│   │   ├── rateLimiter.ts      # Token bucket rate limiter
│   │   ├── mutex.ts            # Mutual exclusion lock
│   │   └── ...                 # Diğer utility'ler
│   │
│   ├── App.tsx                 # Router + auth + lazy routes
│   ├── main.tsx                # React root + SW registration
│   ├── i18n.ts                 # i18next config (TR + EN çevirileri)
│   └── index.css               # Tailwind directives + tema CSS vars
│
├── supabase/
│   └── migrations/             # 7 SQL migration dosyası
│       ├── 20251220..._remote_schema.sql    # Ana şema (users, memories, connections, ai_analyses)
│       ├── 20251221..._expand_categories.sql # Kategori genişletme
│       ├── 20260206..._profile_fields.sql    # Profil alanları
│       ├── 20260206..._memory_overhaul.sql   # Çoklu kategori desteği
│       ├── 20260207..._aiya_chats.sql        # AI sohbet geçmişi
│       ├── 20260207..._aiya_limit.sql        # AI limit güncelleme (50)
│       └── 20260228..._categories_array.sql  # Kategori array optimizasyonu
│
├── android/                    # Android native proje
├── ios/                        # iOS native proje
├── public/                     # Statik dosyalar
├── scripts/                    # Build ve yardımcı script'ler
├── .github/workflows/          # CI/CD (build-apk.yml)
├── capacitor.config.ts         # Capacitor ayarları (appId: com.nicebase.app)
├── vite.config.ts              # Vite + PWA + code splitting
├── tailwind.config.js          # Tema renkleri (primary: #FF6B35)
├── vitest.config.ts            # Test ayarları (jsdom)
└── package.json                # Bağımlılıklar ve script'ler
```

---

## MİMARİ GENEL BAKIŞ

### Offline-First Senkronizasyon Akışı

```
Kullanıcı Aksiyonu
       ↓
  IndexedDB (Dexie) ← Önce local kaydet
       ↓
  Sync Queue V2 ← Queue'ya ekle (dedup + retry)
       ↓
  [Online?] → Evet → Supabase'e gönder
       ↓                    ↓
     Hayır            Çakışma var mı?
       ↓                    ↓
  Bekleme         ConflictResolutionDialog
  (5dk aralık       (kullanıcı seçer)
   + online event)
```

### Veri Akışı

```
Component → Hook (useMemories) → Service (memoryService) → Dexie DB
                                                            ↕
                                              memorySyncService ↔ Supabase
```

### Kimlik Doğrulama

- Supabase Auth (email/password + Google OAuth)
- Native: Google Credential Manager (`@capgo/capacitor-social-login`)
- Web: Browser OAuth redirect akışı
- Session-based route koruması (App.tsx'te kontrol)

---

## VERİTABANI ŞEMASI (ÖZETİ)

### Tablolar

| Tablo | Amaç | Anahtar Alanlar |
|-------|-------|-----------------|
| `users` | Kullanıcı profili | email, displayName, isPremium, language, theme |
| `memories` | Anılar | text, category, categories[], intensity (1-10), date, connections[], lifeArea, isCore, photos[] |
| `connections` | Bağlantılar | name, type (person\|place\|thing\|project) |
| `ai_analyses` | AI analizleri | emotional trends, patterns, recommendations |
| `weekly_summaries` | Haftalık özetler | summary text |
| `aiya_chats` | AI sohbet geçmişi | conversation data |

### Enum Değerleri

- **MemoryCategory:** uncategorized, success, peace, fun, love, gratitude, inspiration, growth, adventure
- **LifeArea:** personal, work, relationship, family, friends, hobby, travel, health, uncategorized
- **ConnectionType:** person, place, thing, project

### IndexedDB (Dexie v3) Tabloları

- `memories` — local anı cache (id, userId, date, category, lifeArea, isCore, synced indeksleri)
- `connections` — local bağlantı cache
- `syncQueueV2` — sync operasyonları (id, userId, entityId, op, status, nextAttemptAt, dedupeKey)

---

## ROUTING (App.tsx)

| Path | Component | Açıklama |
|------|-----------|----------|
| `/login` | Login | Giriş (email/password/OAuth) |
| `/reset-password` | ResetPassword | Şifre sıfırlama |
| `/` | Home | Ana sayfa / dashboard |
| `/vault` | Vault | Anı kasası (arama/filtre) |
| `/add-memory` | AddMemory | Yeni anı oluşturma |
| `/relationship-saver` | RelationshipSaver | Bağlantı slaytları |
| `/aiya` | Aiya | AI sohbet |
| `/statistics` | Statistics | İstatistikler |
| `/achievements` | Achievements | Rozetler |
| `/profile` | Profile | Profil/ayarlar |
| `/profile/connections` | Connections | Bağlantı yönetimi |

Tüm sayfalar `React.lazy()` ile yüklenir, `<Suspense>` ile sarılır.

---

## CI/CD

**GitHub Actions** (`.github/workflows/build-apk.yml`):
- Tetikleme: `main` veya `claude/**` branch'lerine push, manual dispatch
- İşlem: Checkout → Node 20 → Java 17 → npm ci → build → cap sync → Gradle APK
- Artifact: `nicebase-debug-{run_number}` (7 gün tutulur)
- Gerekli secret'lar: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_WEB_CLIENT_ID`, `VITE_OPENAI_API_KEY`

---

## BÖLÜM 1: GENEL KURALLAR (Her Projede Geçerli)

Bu kurallar proje bağımsızdır. Hangi repo olursa olsun bunlara uy.

---

### 1.1 — Dosya Okumadan Değişiklik Yapma

**Kural:** Bir dosyayı düzenlemeden önce MUTLAKA oku.
Okumadığın dosyada değişiklik önerme, tahminle kod yazma.

> Neden: Dosyanın içinde ne olduğunu bilmeden değişiklik yaparsan,
> çalışan kodu bozarsın. Bir odayı görmeden mobilya yerleştirmeye
> çalışmak gibi — dolaba çarparsın.

---

### 1.2 — Hassas Dosyaları Asla Commit'leme

**Kural:** Aşağıdaki dosyaları ASLA `git add` yapma:
- `.env`, `.env.*` (tüm varyantları)
- `credentials.json`, `serviceAccountKey.json`
- `*.pem`, `*.key`, `*.p12`, `*.keystore`, `*.jks`
- `google-services.json`, `GoogleService-Info.plist`
- API key, token, password içeren herhangi bir dosya

> Neden: Bu dosyalarda şifreler ve gizli anahtarlar var. GitHub'a
> push'lanırsa herkes görür. Evin anahtarını kapının önüne koymak gibi.

---

### 1.3 — Silmeden Önce Sor

**Kural:** Dosya silme, branch silme, veritabanı tablosu silme,
`git reset --hard`, `rm -rf` gibi geri dönüşü zor işlemleri
yapmadan ÖNCE kullanıcıdan onay al.

> Neden: Silinen şey geri gelmeyebilir. Bir defteri çöpe atmadan
> önce sormak gibi — belki içinde önemli notlar vardır.

---

### 1.4 — Çalışan Kodu Bozmadan Ekle

**Kural:** Yeni bir özellik eklerken mevcut çalışan özellikleri bozma.
Varolan fonksiyonların imzalarını (parametre sırası, dönüş tipi) değiştirme,
eğer değiştirmek zorundaysan tüm çağrı noktalarını da güncelle.

> Neden: Bir kapıya yeni kilit takarken eski kilidi kırma.
> Eski kilidi kullanan herkes kapıyı açamaz olur.

---

### 1.5 — Olmayan Şeyi İcat Etme

**Kural:** Emin olmadığın bir API, fonksiyon veya kütüphane özelliğini
hallucinate etme. "Sanırım böyle çalışıyor" diye kod yazma —
bilmiyorsan söyle veya dökümantasyonu kontrol et.

> Neden: Var olmayan bir otobüs durağını tarif etmek gibi.
> Kullanıcı oraya gider ama otobüs gelmez, zaman kaybeder.

---

### 1.6 — Tek Seferde Dev Değişiklik Yapma

**Kural:** Bir PR'da veya commit'te 5'ten fazla dosyayı değiştiriyorsan
dur ve kullanıcıya sor. Büyük refactoring'leri adım adım yap.

> Neden: 10 odayı aynı anda boyarsan hangisinde boya bulaşmış
> bilemezsin. Tek tek boyarsan hatayı hemen görürsün.

---

### 1.7 — İstenmeyeni Ekleme

**Kural:** Kullanıcı ne istediyse onu yap. Ekstra "iyileştirme",
gereksiz yorum, kullanılmayan import, fazladan type annotation,
istenmeyen refactoring ekleme.

> Neden: Birisi "bardağıma su koy" derse sadece su koyarsın.
> Yanına limon, buz ve şekerle kokteyl yapmazsın.

---

### 1.8 — Hata Mesajlarını Yutma

**Kural:** try-catch ile hata yakalıyorsan, hatayı MUTLAKA logla
veya kullanıcıya göster. Boş catch bloğu yazma. `console.error`
bile olsa bir şey yaz.

> Neden: Boş catch bloğu = kulağını tıkamak. Sorun var ama
> kimse duymuyor, sonra uygulama sessizce çöküyor.

---

### 1.9 — Force Push Yapma

**Kural:** `git push --force` veya `git push -f` ASLA yapma.
Kullanıcı açıkça isterse bile uyar: "Bu başkalarının çalışmasını silebilir."

> Neden: Force push = herkesin defterini silip kendi defterini
> koymak. Başkalarının yazdıkları kaybolur.

---

### 1.10 — Test Dosyalarını Production Build'e Dahil Etme

**Kural:** Test dosyaları (`*.test.*`, `*.spec.*`, `__tests__/`) sadece
test ortamında çalışır. Bunları production kodu içinde import etme.
Test utility'leri src/ ana dizinine karıştırma.

> Neden: Sınav kağıtlarını ders kitabının içine koymak gibi.
> Kitabı okuyan herkes cevap anahtarını da görür.

---

### 1.11 — Circular Import (Döngüsel Bağımlılık) Yaratma

**Kural:** A dosyası B'yi, B dosyası A'yı import ediyorsa bu döngüsel
bağımlılıktır. YAPMA. Ortak kodu üçüncü bir dosyaya çıkar.

> Neden: İki kişi birbirine "önce sen geç" derse ikisi de geçemez.
> Uygulama açılırken donabilir.

---

### 1.12 — Kütüphane Versiyon Uyumuna Dikkat Et

**Kural:** Yeni bir paket kurarken (`npm install`), mevcut paketlerle
uyumlu olduğundan emin ol. Major versiyon atlama (v1 → v2) gibi
breaking change içeren güncellemeleri kullanıcıya sor.

> Neden: Yeni bir parça takarken eski parçalarla uyuşmazsa
> makine çalışmaz. Lego parçası yerine Duplo koymak gibi.

---

### 1.13 — Asenkron Kodu Senkron Gibi Yazma

**Kural:** `async/await` veya Promise döndüren fonksiyonları çağırırken
`await` koymayı UNUTMA. Promise'ı await'siz kullanma.

> Neden: Yemeği sipariş edip gelmeden tabağa oturmak gibi.
> Tabak boş, ama sen yiyormuş gibi yapıyorsun.

---

### 1.14 — Hardcode'lanmış Değerler Koyma

**Kural:** URL, API endpoint, port numarası, timeout süresi gibi
değişebilecek değerleri doğrudan koda gömme. Config veya
environment variable kullan.

> Neden: Telefon numarasını duvara kazımak gibi. Numara değişince
> duvarı yıkman gerekir.

---

### 1.15 — Console.log Bırakma

**Kural:** Debug amaçlı koyduğun `console.log`'ları commit'lemeden
önce temizle. Sadece bilinçli loglama (`console.error`, `console.warn`
veya projenin loglama servisi) kalmalı.

> Neden: İnşaat bittikten sonra iskeleyi sökmek gibi. İskele
> kalırsa bina çirkin görünür ve yolu kapatır.

---

### 1.16 — Kullanıcı Girdisini Doğrulamadan Kullanma

**Kural:** Kullanıcıdan gelen her veriyi (form input, URL parametresi,
query string) kullanmadan önce doğrula ve sanitize et.
XSS, SQL injection, command injection'a kapı açma.

> Neden: Sokaktan gelen bir paketi açmadan kontrol etmek gibi.
> İçinde ne olduğunu bilmeden eve sokmayın.

---

### 1.17 — Gerekçesiz Kütüphane Ekleme

**Kural:** Yeni npm paketi eklemeden önce: (a) gerçekten gerekli mi,
(b) mevcut bir paketle yapılabilir mi, (c) bakımı yapılıyor mu kontrol et.
5 satır kodla yapılacak iş için paket ekleme.

> Neden: Her iş için yeni alet almak gibi. Çekmece doluyor,
> evi karıştırıyorsun, ve bazı aletler paslı çıkıyor.

---

### 1.18 — Belirsiz Hata Yönetimi

**Kural:** Hata mesajları kullanıcıya anlamlı bilgi vermeli.
"Bir hata oluştu" yerine "Fotoğraf yüklenirken bağlantı hatası" gibi
spesifik mesajlar göster. i18n varsa çeviriyi de ekle.

> Neden: Doktorun "bi sorun var" demesi yerine "kolun kırık" demesi
> gibi. Ne olduğunu bilirsen çözüm bulabilirsin.

---

## BÖLÜM 2: NICEBASE PROJESİNE ÖZEL KURALLAR

Bu kurallar sadece bu projeye özgüdür. Projenin mimarisine ve
teknoloji stack'ine göre yazılmıştır.

---

### 2.1 — Supabase: Yeni Tabloda RLS Zorunlu

**Kural:** Yeni bir Supabase tablosu oluşturuyorsan MUTLAKA:
1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` ekle
2. En az bir SELECT policy yaz: `auth.uid() = user_id`
3. INSERT policy'de `WITH CHECK (auth.uid() = user_id)` kullan
4. Public erişim gerekiyorsa AÇIKÇA belirt ve kullanıcıya sor

> Neden: RLS olmayan tablo = kapısı olmayan oda. Herkes girip
> herkesin verilerini görebilir. Veritabanındaki en tehlikeli hata budur.

**Referans:** Mevcut RLS pattern'ları:
`supabase/migrations/20251220174815_remote_schema.sql`

---

### 2.2 — Supabase: Migration Dosyası Formatı

**Kural:** Veritabanı değişikliklerini her zaman migration dosyası olarak yaz.
Dosya adı formatı: `YYYYMMDDHHMMSS_açıklama.sql`
Konum: `nicebase/supabase/migrations/`

> Neden: Veritabanı değişikliklerini not almak gibi. Not almazsan
> hangi değişikliği ne zaman yaptığını bilemezsin.

---

### 2.3 — State Yönetimi: Zustand Store Kuralları

**Kural:** Global state `/src/store/useStore.ts` dosyasındaki Zustand
store'dadır. Yeni global state eklerken:
1. `AppState` interface'ine type ekle
2. Store'da varsayılan değer ver
3. Persist edilecekse `partialize`'da belirt
4. Gereksiz state ekleme — local state yetiyorsa `useState` kullan

> Neden: Her şeyi global store'a koymak = her eşyayı salona
> koymak. Yatak odası eşyası yatak odasında kalsın.

---

### 2.4 — Servis Katmanı Yapısı

**Kural:** Supabase veya harici API çağrıları doğrudan component'te
yapılmaz. Mutlaka `/src/services/` altında bir servis objesi aracılığıyla
çağrılır. Mevcut pattern:

```typescript
export const exampleService = {
  async getItems() { ... },
  async createItem(data: ItemType) { ... },
}
```

> Neden: Telefonla aramak için telefon rehberini kullanmak gibi.
> Her yere direkt numara yazmak yerine tek bir yerden yönetirsin.

---

### 2.5 — Çeviri (i18n) Zorunluluğu

**Kural:** Kullanıcıya gösterilecek her metin `t('key')` ile çeviri
dosyasından gelmeli. Hardcode Türkçe veya İngilizce metin yazma.
Yeni key eklerken HEM `tr` HEM `en` çevirisini ekle.

Çeviri dosyası: `/src/i18n.ts`
Kullanım: `const { t } = useTranslation()`

> Neden: İki dilli uygulama. Bir dili eklemeyi unutursan, yarısı
> Türkçe yarısı İngilizce görünür. Karışık kanal gibi olur.

---

### 2.6 — Capacitor: Platform Kontrolü

**Kural:** Capacitor native API'leri (kamera, bildirim, haptic vb.)
kullanırken MUTLAKA platform kontrolü yap. Web'de çalışmayan
native özellikleri koşullu çağır.

```typescript
import { Capacitor } from '@capacitor/core'
if (Capacitor.isNativePlatform()) {
  // native-only kod
}
```

> Neden: Bilgisayardan telefon araması yapmaya çalışmak gibi.
> Bilgisayar telefon değil, bu özellik yok — uygulama çöker.

---

### 2.7 — Offline-First: IndexedDB (Dexie) Uyumluluğu

**Kural:** Memory ve kritik veriler önce local Dexie DB'ye yazılır,
sonra Supabase'e senkronize olur. Bu mimariyi kırma:
1. Önce local kaydet
2. Sonra sync queue'ya ekle
3. Online olunca Supabase'e gönder

Dexie şeması: `/src/lib/db.ts`
Sync servisi: `/src/services/memorySyncService.ts`

> Neden: İnternet olmadığında da çalışması lazım. Önce kendi
> defterine yaz, internet gelince buluta yükle.

---

### 2.8 — Component Yapısı ve Dosya Konumu

**Kural:**
- Sayfa component'leri → `/src/pages/`
- Tekrar kullanılan component'ler → `/src/components/`
- Custom hook'lar → `/src/hooks/`
- Yardımcı fonksiyonlar → `/src/utils/`
- Tipler → `/src/types/`

Yeni dosya oluştururken bu yapıya uy. Kendi başına klasör icat etme.

> Neden: Markette ürünler reyonlara ayrılmış. Süt ürünleri
> kasap reyonuna koyarsan kimse bulamaz.

---

### 2.9 — Tailwind CSS Kullanımı

**Kural:** Bu projede stil için Tailwind CSS kullanılıyor.
1. Inline `style={{}}` kullanma, Tailwind class'ları kullan
2. Tema renkleri CSS variable olarak tanımlı (`/src/index.css`)
3. Dark mode desteğini unutma (`.dark` class varyantları)
4. Yeni renk icat etme — mevcut tema renklerini kullan

> Neden: Herkes aynı boya paletini kullanmalı. Herkes kendi
> rengini getirirse duvar yamalı bohça gibi olur.

---

### 2.10 — Environment Variable'lar

**Kural:** Env variable'lar `import.meta.env.VITE_` prefix'i ile
erişilir. Yeni env variable eklerken:
1. `VITE_` prefix'i olmalı (client-side erişim için)
2. `.env.example` veya dökümantasyona ekle
3. ASLA default değer olarak gerçek API key koyma

Mevcut env'ler:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_WEB_CLIENT_ID`
- `VITE_OAUTH_REDIRECT_URL`
- `VITE_OAUTH_WEB_REDIRECT_URL`
- `VITE_OPENAI_API_KEY`

> Neden: Env variable = gizli not defteri. Herkese açık kodda
> gizli not defterinin içeriğini yazmıyorsun.

---

### 2.11 — Router: Code Splitting Kuralı

**Kural:** Yeni sayfa eklerken `React.lazy()` kullan.
App.tsx'teki mevcut pattern'ı takip et:

```typescript
const NewPage = lazy(() => import('./pages/NewPage'))
```

Route tanımında `<Suspense>` wrapper olduğundan emin ol.

> Neden: Lazy loading = sadece ihtiyacın olan odanın ışığını
> açmak. Tüm evi aydınlatmak yerine enerji tasarrufu yaparsın.
> Uygulama daha hızlı açılır.

---

### 2.12 — Mapper Fonksiyonları: snake_case ↔ camelCase

**Kural:** Supabase'den gelen veri `snake_case`, uygulama içinde
`camelCase` kullanılır. Dönüşüm için mevcut mapper'ları kullan:
- `/src/lib/memoryMapper.ts`
- `/src/lib/userMapper.ts`

Yeni tablo eklersen yeni bir mapper yaz, aynı pattern'ı izle.

> Neden: Supabase Türkçe konuşuyor, React İngilizce konuşuyor.
> Arada tercüman (mapper) olmazsa birbirlerini anlamıyorlar.

---

### 2.13 — Toast Bildirimleri

**Kural:** Kullanıcıya bildirim göstermek için `react-hot-toast` kullan:
```typescript
import toast from 'react-hot-toast'
toast.success(t('success.message'))
toast.error(t('error.message'))
```
Alert, window.alert, veya kendi bildirim mekanizmanı icat etme.

> Neden: Herkes aynı zili çalmalı. Biri zil çalıyor, biri bağırıyor,
> biri ıslık çalıyorsa kaos olur.

---

### 2.14 — Animasyonlar: Framer Motion

**Kural:** Animasyon için Framer Motion kullanılıyor.
CSS transition yerine `motion` component'lerini tercih et.
Mevcut animasyon pattern'larını takip et, aşırı animasyon ekleme.

> Neden: Aynı animasyon kütüphanesini kullan, yoksa bazı
> animasyonlar pürüzsüz, bazıları kasarak çalışır.

---

### 2.15 — Form Validasyonu

**Kural:** Form doğrulama fonksiyonları `/src/utils/formValidation.ts`
dosyasında. Yeni form ekliyorsan:
1. Validasyon fonksiyonunu `formValidation.ts`'e ekle
2. Hata mesajlarını i18n'den al
3. Submit butonunu validasyon geçmeden aktif etme

> Neden: Kapıya kilit takmak gibi. Anahtarsız kimse girmesin.
> Yanlış veri girince uygulama bozulmasın.

---

### 2.16 — Fotoğraf İşlemleri

**Kural:** Fotoğraf yükleme ve işleme `/src/services/photoStorageService.ts`
üzerinden yapılır. Kendi upload mantığını yazma.
Fotoğrafları compress et, orijinal boyutta yükleme.

> Neden: 10MB'lık fotoğrafları olduğu gibi yüklemek = kargo ile
> koca bir kutu göndermek. Sıkıştırırsan hem hızlı hem ucuz olur.

---

### 2.17 — Error Logging

**Kural:** Önemli hataları loglarken `/src/services/errorLoggingService.ts`
kullan. Kullanıcı aksiyonlarında oluşan hatalar bu servisle loglanmalı.

> Neden: Hastane kayıt sistemi gibi. Her hasta kaydını tutarsan
> sonra hangi hastalık sık çıkıyor anlarsın.

---

### 2.18 — Build Kontrolü

**Kural:** Commit'lemeden ÖNCE `npm run build` çalıştır ve başarılı
olduğundan emin ol. TypeScript hataları olan kodu commit'leme.

> Neden: Arabayı tamirciden almadan önce kontrol ettirmek gibi.
> Tamirciden aldın, yolda kaldın — çok geç.

---

### 2.19 — Test Çalıştırma

**Kural:** Mevcut testleri etkileyen bir değişiklik yaptıysan
`npm run test` çalıştır. Testler kırılıyorsa düzelt.
Yeni servis/utility fonksiyonu ekliyorsan test yaz.

Test framework: Vitest
Test dizini: `src/**/__tests__/*.test.ts`

> Neden: Değişiklik yaptın, eski şeyler bozuldu mu? Test =
> her değişiklikten sonra kontrol listesini geçmek.

---

## BÖLÜM 3: YASAKLAR (ASLA YAPMA)

Kırmızı çizgiler. Bunları yapan değişiklik reddedilir.

| # | YASAK | NEDEN |
|---|-------|-------|
| 1 | `.env` veya secret içeren dosyayı commit'leme | Şifreler herkese açık olur |
| 2 | RLS olmadan tablo oluşturma | Herkes herkesin verisini görür |
| 3 | `git push --force` | Başkalarının çalışması silinir |
| 4 | `await` olmadan async fonksiyon çağırma | Veri gelmeden işlem yapar, sessizce bozulur |
| 5 | Hardcode API key veya URL koyma | Ortam değişince uygulama çöker |
| 6 | Boş catch bloğu yazma | Hatalar sessizce yutulur |
| 7 | i18n kullanmadan UI'da metin yazmak | Yarısı Türkçe yarısı İngilizce görünür |
| 8 | Mevcut dosya yapısını bozan klasör icat etme | Kimse dosyayı bulamaz |
| 9 | `--no-verify` ile hook atlama | Güvenlik kontrollerini devre dışı bırakır |
| 10 | Kullanıcıdan onay almadan dosya/branch silme | Geri dönüşü olmayabilir |

---

## BÖLÜM 4: COMMIT ÖNCESİ KONTROL LİSTESİ

Her commit'ten önce bu listeyi zihinsel olarak geç:

- [ ] Değiştirdiğim dosyaları önce okudum mu?
- [ ] Hassas dosya (env, key, credential) staging'e girmedi mi?
- [ ] Yeni Supabase tablosunda RLS var mı?
- [ ] Tüm UI metinleri i18n'den mi geliyor (hem TR hem EN)?
- [ ] `await` unuttuğum async çağrı var mı?
- [ ] Boş catch bloğu var mı?
- [ ] `console.log` debug kodu kaldı mı?
- [ ] Build başarılı mı? (`npm run build`)
- [ ] Testler geçiyor mu? (`npm run test`)
- [ ] Değişiklik sayısı makul mü? (5+ dosya ise kullanıcıya sor)

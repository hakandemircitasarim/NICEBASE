# CLAUDE.md — AI Asistan Kuralları

Bu dosya, bu projede çalışan her AI asistanın (Claude, Cursor, Copilot, vb.)
**her konuşma başlangıcında** okuması ve uyması gereken kurallardır.

Kuralları çiğnemek = production'da patlama. Kurallar tartışılmaz.

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

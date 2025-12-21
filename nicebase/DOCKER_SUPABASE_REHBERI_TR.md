# NICEBASE — Docker / Supabase “Nerede Çalışıyorum?” Rehberi (TR)

Bu doküman, **Docker**, **Supabase (local)** ve **Supabase Cloud (canlı)** arasındaki farkı basitçe anlatır ve “env değişince ne yapacağım?” sorusuna net cevap verir.

## En kritik bilgi (1 cümle)

Uygulamanın hangi veritabanına bağlandığını **`.env` içindeki `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` belirler**.

## 1) 3 farklı “çalışma modu” var

### A) Sadece Offline (Supabase yok)

- **Ne demek**: Uygulama sadece cihazda çalışır (IndexedDB). Bulut senkron yok.
- **Ne zaman**: Demo/test, internet yokken, hızlı prototip.
- **Ne yapmalıyım**: `.env` boş olabilir. `npm run dev` yeter.

### B) Local Supabase (Docker üzerinde)

- **Ne demek**: Bilgisayarında Docker içinde Supabase çalışır. Bu **geçici** bir geliştirme ortamıdır.
- **Önemli**: Local Supabase’deki kullanıcılar ve anılar **canlı ile aynı değildir**. Local ortamı sıfırlarsan, local veriler gider.
- **Ne zaman**: Lokal test, schema/migration denemeleri, gerçek datayı riske atmadan geliştirme.

### C) Hosted Supabase (Supabase Cloud = “canlıya yakın / canlı”)

- **Ne demek**: `https://supabase.com` üzerinde bir proje. İnternetten erişilir.
- **Ne zaman**: Gerçek kullanıcı / gerçek veri, “yayınlanacak sürüm”ün bağlanacağı backend.

## 2) “Env değiştirdim, reset gerekir mi?”

Genelde **hayır**.

- **Sadece `.env` değiştirdiysen** (URL/key): Yapman gereken çoğu zaman **dev server’ı yeniden başlatmak**.
- **Supabase’in local config’i / secrets’i değiştiyse**: `supabase stop` + `supabase start` yeter (DB silmez).
- **`supabase db reset`**: Bu komut **local DB’yi siler ve yeniden kurar**. Env değişikliği için kullanılmaz.

## 3) “Reset attım, DB silindi” neden oldu?

Çünkü `supabase db reset` mantıken şunu yapar:

- Local Postgres’i **drop + recreate** eder
- Migration’ları tekrar çalıştırır
- Varsa seed dosyasını çalıştırır

Bu yüzden local Supabase’de kayıtlı kullanıcılar/anılar da gider. (Hosted Supabase Cloud’u silmez; doğru projeye bağlandıysan sadece local’i etkiler.)

## 4) Günlük çalışma — “en güvenli” basit akış

### Frontend’i çalıştır

```bash
cd nicebase
npm install
npm run dev
```

### “Lovable tarzı” minimal komutlar (kopyala/yapıştır)

Local Supabase (Docker) başlat/durdur/durum:

```bash
cd nicebase
npm run supabase:start
npm run supabase:status
```

Kapatmak için:

```bash
cd nicebase
npm run supabase:stop
```

### Supabase Cloud kullanacaksan (en basit)

1. Supabase’de proje aç
2. `Settings -> API` bölümünden `Project URL` + `anon public key` al
3. `env.example` dosyasını `.env` yap ve doldur

Windows (PowerShell):

```powershell
cd nicebase
Copy-Item .\env.example .\.env
```

Sonra `.env` içine şunları gir:

- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

Ve `npm run dev`’i kapat/aç.

### Local Supabase (Docker) kullanacaksan

Ön şart: Docker Desktop açık olmalı.

```bash
cd nicebase
npx supabase start
npx supabase status
```

`supabase status` çıktısından:

- **API URL** → `VITE_SUPABASE_URL`
- **anon key** → `VITE_SUPABASE_ANON_KEY`

`.env`’i güncelle ve `npm run dev`’i kapat/aç.

## 5) “Canlıya ne zaman geçeceğiz?” (pratik cevap)

- Canlıya geçmek demek: Uygulamanın `.env`’de **prod Supabase Cloud projesine** bakması ve schema/migration’ların o projede uygulanmış olması demek.
- İdeal düzen:
  - **DEV Supabase** (test verisi)
  - **PROD Supabase** (gerçek verisi)

## 6) Altın kurallar (yanlışlıkla veri silmeyi engeller)

- **KURAL 1**: Env değişti diye **DB reset atılmaz**. Önce sadece restart.
- **KURAL 2**: “Gerçek veri” istiyorsan local değil, **Supabase Cloud** kullan.
- **KURAL 3**: Local ortam “deneme alanı”dır; zaman zaman silinebilir.

## 7) Hızlı teşhis: Şu an nereye bağlıyım?

- `.env` içindeki `VITE_SUPABASE_URL`:
  - `http://127.0.0.1:54321` gibi bir şeyse → **LOCAL**
  - `https://xxxx.supabase.co` ise → **CLOUD**
  - boşsa → **OFFLINE**

Ek kolay yol (önerilen):

```bash
cd nicebase
npm run doctor
```

Bu komut `.env` dosyana bakıp “LOCAL mi CLOUD mu?” net yazar ve yanlışlıkla reset atmanı önlemek için uyarı verir.



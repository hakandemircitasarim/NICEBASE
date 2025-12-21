# NICEBASE — “Sadece yazarım, sen migration yap” akışı (TR)

Senin hedefin: Supabase paneline girmeden, DB değişikliklerini **dosya (migration)** ile yönetmek.

## Temel fikir

- **AI (Cursor)**: Migration dosyasını + kodu (types/service/UI) hazırlar.
- **Sen**: “Publish” için sadece **1 komut** çalıştırırsın.

Bu sayede AI “tahmin” etmez; repodaki migration dosyası “gerçek” kaynaktır.

## 0) One-time (1 kere) kurulum

### A) Supabase Cloud publish için token/ref dosyası

1. `env.supabase.example` dosyasını `.env.supabase` yap
2. İçini doldur:
   - `SUPABASE_PROJECT_REF`
   - `SUPABASE_ACCESS_TOKEN`

> Not: `.env.supabase` sadece senin bilgisayarında kalmalı. Git’e koyma.

### B) `.env` ile `.env.supabase` karışmasın (çok önemli)

- **`.env`**: Uygulamanın çalışması için (Vite) → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OPENAI_API_KEY` vb.
- **`.env.supabase`**: Sadece migration publish için (CLI) → `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`

Yani `.env` içeriğini **kopyalayıp** `.env.supabase`’e taşıma.

## 1) DB değişikliği isteme (senin yapacağın)

Örnek prompt:

- “Users tablosuna `age` alanı ekle, UI ve tipleri bozma.”

## 2) AI’ın yaptığı (Cursor)

- `supabase/migrations/YYYYMMDDHHMMSS_...sql` dosyasını oluşturur (SQL değişiklik)
- Gerekirse TypeScript tiplerini ve Supabase mapper/service kodlarını günceller

## 3) Publish (senin yapacağın — tek komut)

Önce “ne uygulayacak” diye görmek istersen:

```bash
cd nicebase
npm run db:publish:dry
```

Hazırsa canlıya uygula:

```bash
cd nicebase
npm run db:publish
```

## Önemli uyarılar

- Bu akış **Supabase Cloud** içindir (sen “bağlı zaten” demiştin).
- Docker (local Supabase) **şart değil**. Sadece güvenli test ortamı olarak opsiyonel.
- `supabase db reset` **local DB’yi siler**. Cloud publish ile karıştırma.



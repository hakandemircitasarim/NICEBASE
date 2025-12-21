# NICEBASE - Kişisel Duygusal Çapan

NICEBASE, olumsuz düşüncelerle başa çıkmak için güzel anıları saklayan ve hatırlatan bir uygulamadır.

## Özellikler

- 📦 **Anı Kasası**: Tüm anılarınızı kategorize ederek saklayın
- 🎲 **Recall Widget**: Zor anlarda rastgele güzel anılar
- 💝 **Bağlantı Kurtarıcı**: Kişiye özel anı slayt gösterisi
- 🤖 **Aiya AI**: Kişiselleştirilmiş duygusal destek chatbot'u
- 📊 **İstatistikler**: Detaylı analiz ve grafikler
- 📴 **Çevrimdışı Çalışma**: IndexedDB ile tam offline destek
- ☁ **Bulut Yedekleme**: Supabase ile senkronizasyon
- 🌍 **Çoklu Dil**: Türkçe ve İngilizce
- 🌓 **Karanlık/Aydınlık Mod**

## Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. `.env` dosyası oluşturun:

Windows (PowerShell):

```bash
Copy-Item .\env.example .\.env
```

macOS/Linux:

```bash
cp env.example .env
```

3. Supabase projesi oluşturun ve `supabase-schema.sql` dosyasını çalıştırın.

4. `.env` dosyasına Supabase ve OpenAI API anahtarlarınızı ekleyin.

5. Geliştirme sunucusunu başlatın:
```bash
npm run dev
```

## Docker / Local Supabase vs Canlı (Önemli)

Projede iki farklı backend çalışma şekli var:

- **Supabase Cloud (en basit / gerçek veri)**: `.env` içine Supabase Cloud URL + anon key koyarsınız.
- **Local Supabase (Docker)**: Bilgisayarınızda Docker içinde Supabase çalıştırırsınız.

Detaylı anlatım ve “env değişince reset gerekir mi?” sorusunun cevabı için:

- `DOCKER_SUPABASE_REHBERI_TR.md`

**Uyarı**: `supabase db reset` komutu **local veritabanını siler** (kullanıcılar/anılar dahil). Env değişikliği için kullanılmaz.

## DB Değişikliklerini “Migration ile” Yönetme (Panel yok)

Eğer DB değişikliklerini Supabase panelinden yapmak istemiyorsan ve “sadece yazayım, Cursor migration hazırlasın” istiyorsan:

- `MIGRATION_AKISI_TR.md`

## Build

```bash
npm run build
```

## Teknolojiler

- React + TypeScript
- Vite
- Tailwind CSS
- Supabase (Backend)
- IndexedDB (Dexie.js)
- OpenAI API
- React Router
- Recharts












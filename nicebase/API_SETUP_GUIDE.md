# API Kurulum Rehberi

Bu rehber, NICEBASE uygulaması için gerekli tüm API key'lerin ve entegrasyonların nasıl yapılandırılacağını açıklar.

## 📋 Gerekli API Key'ler

### 1. Supabase (Backend + Auth)

**Zorunlu**: Evet ✅

**Neden**: 
- Veritabanı (anılar, kullanıcılar)
- Authentication (email/password, OAuth)
- Cloud sync
- Row Level Security (RLS)

**Nasıl Alınır**:
1. [Supabase](https://supabase.com) hesabı oluşturun
2. Yeni proje oluşturun
3. Settings > API bölümünden:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`

**`.env` dosyasına ekleyin**:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

### 2. OpenAI (Aiya AI Asistanı)

**Zorunlu**: Hayır ⚠️ (Aiya sayfası çalışmaz ama diğer özellikler çalışır)

**Neden**: 
- Aiya chatbot özelliği
- Anı analizi
- Kategori önerileri

**Nasıl Alınır**:
1. [OpenAI Platform](https://platform.openai.com) hesabı oluşturun
2. API Keys bölümünden yeni key oluşturun
3. Key'i kopyalayın

**`.env` dosyasına ekleyin**:
```env
VITE_OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Not**: Ücretli servis. Kullanım başına ücretlendirme var. `gpt-4o-mini` modeli kullanılıyor (daha ekonomik).

---

## 🔐 OAuth Provider'ları (Google, Apple)

### Google OAuth

**Zorunlu**: Hayır (Opsiyonel ama önerilir)

**Nasıl Yapılandırılır**:

1. **Google Cloud Console**:
   - [Google Cloud Console](https://console.cloud.google.com) → Yeni proje oluşturun
   - APIs & Services > Credentials
   - OAuth 2.0 Client ID oluşturun
   - Application type: Web application
   - Authorized redirect URIs ekleyin:
     ```
     https://your-project-id.supabase.co/auth/v1/callback
     ```
   - Client ID ve Client Secret'i kopyalayın

2. **Supabase Dashboard**:
   - Authentication > Providers > Google
   - Enable Google provider
   - Client ID ve Client Secret'i yapıştırın
   - Save

**Artık Google ile giriş yapılabilir!** ✅

---

### Apple OAuth

**Zorunlu**: Hayır (Opsiyonel, iOS için önerilir)

**Nasıl Yapılandırılır**:

1. **Apple Developer**:
   - [Apple Developer](https://developer.apple.com) hesabı gerekli
   - Certificates, Identifiers & Profiles
   - Services ID oluşturun
   - Return URLs ekleyin:
     ```
     https://your-project-id.supabase.co/auth/v1/callback
     ```

2. **Supabase Dashboard**:
   - Authentication > Providers > Apple
   - Enable Apple provider
   - Services ID, Team ID, Key ID, Private Key ekleyin
   - Save

**Not**: Apple OAuth için Apple Developer Program üyeliği gerekli ($99/yıl).

---

## 📝 .env Dosyası Örneği

Proje kök dizininde `.env` dosyası oluşturun (şablon: `env.example`):

```env
# Supabase (ZORUNLU)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# OpenAI (OPSİYONEL - Aiya için)
VITE_OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Önemli**: 
- `.env` dosyası `.gitignore`'da olmalı (güvenlik)
- `env.example` dosyası template olarak kullanılabilir (bu repo’da `.env.example` yok)
- Production'da environment variable'lar hosting platform'unda ayarlanmalı

---

## 🚀 Supabase Database Setup

### 1. SQL Schema'yı Çalıştırın

`supabase-schema.sql` dosyasını Supabase SQL Editor'de çalıştırın:

```bash
# Supabase Dashboard > SQL Editor > New Query
# supabase-schema.sql dosyasının içeriğini yapıştırın ve Run
```

### 2. Row Level Security (RLS) Aktif

RLS politikaları schema'da tanımlı. Kontrol edin:
- Supabase Dashboard > Authentication > Policies
- Tüm tablolarda RLS aktif olmalı

---

## ✅ Kontrol Listesi

### Minimum (Uygulama Çalışır)
- [x] Supabase URL ve Anon Key
- [x] Database schema kuruldu
- [x] RLS politikaları aktif

### Önerilen (Tam Özellikler)
- [ ] OpenAI API Key (Aiya için)
- [ ] Google OAuth (Kolay giriş)
- [ ] Apple OAuth (iOS için)

---

## 🔧 Troubleshooting

### "Supabase configuration error" hatası
- `.env` dosyasını kontrol edin
- `VITE_` prefix'i olduğundan emin olun
- Uygulamayı yeniden başlatın (`npm run dev`)

### “Env değiştirdim, DB reset mi atacağım?” (ÖNEMLİ)

- Env değişikliği için genelde **DB reset gerekmez**, sadece `npm run dev`’i kapat/aç yeter.
- `supabase db reset` **local DB’yi siler** (kullanıcılar/anılar dahil).
- Detaylı rehber: `DOCKER_SUPABASE_REHBERI_TR.md`

### "OpenAI service is currently unavailable"
- `.env` dosyasında `VITE_OPENAI_API_KEY` var mı?
- API key geçerli mi?
- Billing aktif mi? (OpenAI ücretli)

### OAuth çalışmıyor
- Supabase Dashboard'da provider aktif mi?
- Redirect URI doğru mu?
- Google/Apple console'da ayarlar doğru mu?

### Database bağlantı hatası
- Supabase projesi aktif mi?
- Schema çalıştırıldı mı?
- RLS politikaları doğru mu?

---

## 📚 Kaynaklar

- [Supabase Docs](https://supabase.com/docs)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Google OAuth Setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Apple OAuth Setup](https://supabase.com/docs/guides/auth/social-login/auth-apple)

---

## 💡 İpuçları

1. **Development**: `.env` dosyası kullanın
2. **Production**: Hosting platform'unun environment variable ayarlarını kullanın
3. **Güvenlik**: API key'leri asla commit etmeyin
4. **Test**: Her API key'i ayrı ayrı test edin
5. **Backup**: API key'leri güvenli bir yerde saklayın

---

**Son Güncelleme**: 2024
**Versiyon**: 1.0.0








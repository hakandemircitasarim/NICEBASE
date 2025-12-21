# 🎯 NICEBASE Kurulum Rehberi - Adım Adım

## 📝 Adım 1: Supabase Hesabı Oluştur

1. https://supabase.com adresine git
2. "Start your project" butonuna tıkla
3. GitHub ile giriş yap (veya email ile kayıt ol)
4. "New Project" butonuna tıkla
5. Proje adı: `nicebase` (veya istediğin bir isim)
6. Şifre oluştur (SAKLA, bir daha göremezsin!)
7. Bölge seç: En yakın olanı (örn: Europe West)
8. "Create new project" butonuna tıkla
9. 2-3 dakika bekle (proje hazırlanıyor)

## 📋 Adım 2: Supabase Veritabanını Hazırla

1. Sol menüden "SQL Editor" seçeneğine tıkla
2. "New query" butonuna tıkla
3. `supabase-schema.sql` dosyasını aç (proje klasöründe)
4. İçindeki TÜM kodu kopyala
5. Supabase SQL Editor'a yapıştır
6. Sağ üstteki "Run" butonuna tıkla (veya Ctrl+Enter)
7. "Success" mesajını gör

## 🔑 Adım 3: API Anahtarlarını Bul

1. Supabase'de sol menüden "Project Settings" (⚙️) seç
2. Sol menüden "API" seçeneğine tıkla
3. Şunları kopyala:
   - **Project URL** (örnek: `https://xxxxx.supabase.co`)
   - **anon public** key (çok uzun bir metin)

## 🤖 Adım 4: OpenAI API Anahtarı Al

1. https://platform.openai.com adresine git
2. Giriş yap (yoksa kayıt ol)
3. Sağ üstte profil ikonuna tıkla → "API keys"
4. "Create new secret key" butonuna tıkla
5. İsim ver: `nicebase`
6. Anahtarı kopyala (BİR DAHA GÖREMEZSİN! Sakla)

## 📁 Adım 5: .env Dosyası Oluştur

1. `nicebase` klasörüne git
2. Yeni bir dosya oluştur: `.env` (nokta ile başlıyor!)
3. İçine şunu yapıştır:

```
VITE_SUPABASE_URL=buraya_supabase_url_yapıştır
VITE_SUPABASE_ANON_KEY=buraya_supabase_anon_key_yapıştır
VITE_OPENAI_API_KEY=buraya_openai_key_yapıştır
```

4. Kendi anahtarlarını yapıştır (tırnak işareti YOK!)

Örnek:
```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_OPENAI_API_KEY=sk-proj-abc123...
```

## 📦 Adım 6: Paketleri Yükle

1. Terminal/PowerShell'i aç
2. `nicebase` klasörüne git:
   ```bash
   cd nicebase
   ```

3. Paketleri yükle:
   ```bash
   npm install
   ```
   
4. 1-2 dakika bekle (paketler indiriliyor)

## 🚀 Adım 7: Uygulamayı Çalıştır

1. Hala `nicebase` klasöründesin
2. Şu komutu çalıştır:
   ```bash
   npm run dev
   ```

3. Terminal'de bir link göreceksin, örneğin:
   ```
   ➜  Local:   http://localhost:5173/
   ```

4. Bu linke tıkla veya tarayıcıda aç

## ✅ Adım 8: İlk Kullanıcıyı Oluştur

1. Uygulama açıldığında "Kayıt Ol" ekranı görünecek
2. Email ve şifre gir
3. "Kayıt Ol" butonuna tıkla
4. Supabase'den email doğrulama linki gelecek (spam klasörüne bakabilir)
5. Linke tıkla (veya şimdilik atla, test için çalışır)

## 🎉 TAMAM!

Artık uygulaman çalışıyor! 

### Sorun mu var?

**"Cannot find module" hatası:**
- `npm install` komutunu tekrar çalıştır

**"Supabase connection error":**
- `.env` dosyasındaki anahtarları kontrol et
- Tırnak işareti olmamalı
- Boşluk olmamalı

**"OpenAI error":**
- OpenAI API anahtarını kontrol et
- OpenAI hesabında kredi var mı kontrol et

**Port zaten kullanılıyor:**
- Terminal'de Ctrl+C ile durdur
- `npm run dev -- --port 5174` ile farklı port dene












# Dev Server Başlatma

## “En temiz” günlük rutin (önerilen)

### 1) (Opsiyonel) Local Supabase kullanıyorsan başlat

```bash
cd nicebase
npm run supabase:start
npm run supabase:status
```

`supabase:status` çıktısından **API URL** ve **anon key** değerlerini `.env` içine koy.

### 2) Frontend’i başlat

```bash
cd nicebase
npm run dev
```

**Not**: `.env` değiştirdiysen genelde sadece `npm run dev` kapat/aç yeter. DB reset gerekmez.

## Hata: ERR_CONNECTION_REFUSED (-102) Çözümü

Eğer `http://localhost:5173/` bağlanamıyorsanız:

### 1. Dev Server'ı Başlat
```bash
cd nicebase
npm run dev
```

### 2. Port Kontrolü
Eğer port 5173 kullanılıyorsa, Vite otomatik olarak bir sonraki boş portu kullanacak.
Terminal'de hangi portta çalıştığını göreceksiniz.

### 3. Tarayıcıda Service Worker'ı Temizle
- Chrome/Edge: `chrome://serviceworker-internals/` veya `edge://serviceworker-internals/`
- Tüm service worker'ları "Unregister" ile kaldır
- DevTools > Application > Service Workers > Unregister

### 4. Cache Temizle
- DevTools > Application > Storage > Clear site data
- Veya `Ctrl+Shift+Delete` ile cache temizle

### 5. Hard Refresh
- `Ctrl+F5` veya `Ctrl+Shift+R`

### Alternatif: Farklı Port Kullan
Eğer 5173 portu sorun çıkarıyorsa:
```bash
npm run dev -- --port 3000
```


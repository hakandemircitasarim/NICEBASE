// Comprehensive fix for old UI appearing - clears all caches and rebuilds
import { rmSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('🔧 Eski arayüz sorununu düzeltiyoruz...\n')

// 1. Web build cache'lerini temizle
console.log('1️⃣  Web build cache temizleniyor...')
const webPathsToClean = [
  join(__dirname, 'node_modules', '.vite'),
  join(__dirname, 'dist'),
  join(__dirname, 'dev-dist'),
]

webPathsToClean.forEach(path => {
  try {
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true })
      console.log(`   ✅ Temizlendi: ${path}`)
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`   ⚠️  Temizlenemedi ${path}:`, error.message)
    }
  }
})

// 2. Android build cache'lerini temizle
console.log('\n2️⃣  Android build cache temizleniyor...')
const androidPathsToClean = [
  join(__dirname, 'android', 'app', 'build'),
  join(__dirname, 'android', 'app', 'src', 'main', 'assets', 'public'),
  join(__dirname, 'android', '.gradle'),
  join(__dirname, 'android', 'app', '.cxx'),
]

androidPathsToClean.forEach(path => {
  try {
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true })
      console.log(`   ✅ Temizlendi: ${path}`)
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`   ⚠️  Temizlenemedi ${path}:`, error.message)
    }
  }
})

// 3. Yeni web build yap
console.log('\n3️⃣  Yeni web build yapılıyor...')
try {
  console.log('   📦 npm run build çalıştırılıyor...')
  execSync('npm run build', { 
    cwd: __dirname, 
    stdio: 'inherit',
    shell: true
  })
  console.log('   ✅ Web build tamamlandı!')
} catch (error) {
  console.error('   ❌ Build hatası:', error.message)
  process.exit(1)
}

// 4. Capacitor sync
console.log('\n4️⃣  Capacitor sync yapılıyor...')
try {
  console.log('   🔄 npm run cap:sync çalıştırılıyor...')
  execSync('npm run cap:sync', { 
    cwd: __dirname, 
    stdio: 'inherit',
    shell: true
  })
  console.log('   ✅ Capacitor sync tamamlandı!')
} catch (error) {
  console.error('   ❌ Sync hatası:', error.message)
  process.exit(1)
}

console.log('\n✨ Tüm işlemler tamamlandı!')
console.log('\n📱 Şimdi yapmanız gerekenler:')
console.log('   1. Android Studio\'yu açın: npm run cap:open:android')
console.log('   2. Android Studio\'da: Build > Clean Project')
console.log('   3. Android Studio\'da: Build > Rebuild Project')
console.log('   4. Uygulamayı cihazda/emülatörde çalıştırın')
console.log('\n💡 Eğer hala eski arayüz görünüyorsa:')
console.log('   - Android cihazda: Ayarlar > Uygulamalar > NICEBASE > Depolama > Verileri Temizle')
console.log('   - Veya uygulamayı kaldırıp yeniden yükleyin')







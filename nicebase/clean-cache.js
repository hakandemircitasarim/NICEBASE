// Cross-platform cache cleaner for Vite
import { rmSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const pathsToClean = [
  join(__dirname, 'node_modules', '.vite'),
  join(__dirname, 'dist'),
  join(__dirname, 'dev-dist'),
]

console.log('🧹 Cleaning cache...')

pathsToClean.forEach(path => {
  try {
    rmSync(path, { recursive: true, force: true })
    console.log(`✅ Cleaned: ${path}`)
  } catch (error) {
    // Ignore if directory doesn't exist
    if (error.code !== 'ENOENT') {
      console.warn(`⚠️  Could not clean ${path}:`, error.message)
    }
  }
})

console.log('✨ Cache cleaned!')









import chokidar from 'chokidar'
import { exec } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let isBuilding = false
let buildTimeout = null
let watcher = null

// Watch for changes in src directory
const srcDir = join(__dirname, 'src')
// Watch all files in src directory recursively
const watchDir = srcDir

console.log('🚀 Auto Watch & Sync Script Started!')
console.log('👀 Watching for changes in src/ directory...')
console.log('📦 Auto-building and syncing on file changes...')
console.log('💡 After changes, just press Run in Android Studio/Xcode!')
console.log('Press Ctrl+C to stop\n')

function debounceBuild() {
  if (buildTimeout) {
    clearTimeout(buildTimeout)
  }

  buildTimeout = setTimeout(async () => {
    if (isBuilding) {
      console.log('⏳ Build already in progress, skipping...')
      return
    }

    isBuilding = true
    console.log('\n🔄 Changes detected! Building...')

    try {
      // Build
      console.log('📦 Running npm run build...')
      const { stdout: buildOutput, stderr: buildError } = await execAsync('npm run build', { cwd: __dirname })
      if (buildOutput) console.log(buildOutput)
      if (buildError && !buildError.includes('warning')) console.error(buildError)
      console.log('✅ Build successful!')

      // Sync
      console.log('🔄 Syncing with Capacitor...')
      const { stdout: syncOutput, stderr: syncError } = await execAsync('npm run cap:sync', { cwd: __dirname })
      if (syncOutput) console.log(syncOutput)
      if (syncError && !syncError.includes('warning')) console.error(syncError)
      console.log('✅ Sync complete!')
      console.log('✨ Ready! Just press Run in Android Studio/Xcode!\n')
    } catch (error) {
      console.error('❌ Error:', error.message)
      if (error.stdout) console.log(error.stdout)
      if (error.stderr) console.error(error.stderr)
    } finally {
      isBuilding = false
    }
  }, 2000) // Wait 2 seconds after last change
}

// Watch src directory recursively using chokidar (more reliable than fs.watch)
try {
  watcher = chokidar.watch(watchDir, {
    ignored: [
      /(^|[\/\\])\../, // ignore dotfiles
      /node_modules/,
      /\.git/,
      /\.DS_Store/,
      /dist/,
      /\.vite/,
      /android/,
      /ios/,
      /\.(swp|swo|tmp)$/,
    ],
    persistent: true,
    ignoreInitial: true,
    usePolling: process.platform === 'win32', // Use polling on Windows for better reliability
    interval: 1000, // Polling interval in ms
    binaryInterval: 1000,
    awaitWriteFinish: {
      stabilityThreshold: 1000, // Wait 1 second for file to stabilize
      pollInterval: 200
    },
    depth: 10, // Watch up to 10 levels deep
    followSymlinks: false
  })

  watcher
    .on('add', (path) => {
      const relativePath = path.replace(__dirname + (process.platform === 'win32' ? '\\' : '/'), '')
      console.log(`📝 Added: ${relativePath}`)
      debounceBuild()
    })
    .on('change', (path) => {
      const relativePath = path.replace(__dirname + (process.platform === 'win32' ? '\\' : '/'), '')
      console.log(`📝 Changed: ${relativePath}`)
      debounceBuild()
    })
    .on('unlink', (path) => {
      const relativePath = path.replace(__dirname + (process.platform === 'win32' ? '\\' : '/'), '')
      console.log(`📝 Deleted: ${relativePath}`)
      debounceBuild()
    })
    .on('addDir', (path) => {
      const relativePath = path.replace(__dirname + (process.platform === 'win32' ? '\\' : '/'), '')
      console.log(`📁 Directory added: ${relativePath}`)
    })
    .on('unlinkDir', (path) => {
      const relativePath = path.replace(__dirname + (process.platform === 'win32' ? '\\' : '/'), '')
      console.log(`📁 Directory removed: ${relativePath}`)
      debounceBuild()
    })
    .on('error', (error) => {
      console.error('❌ Watcher error:', error)
      console.log('🔄 Attempting to restart watcher...')
      // Try to restart watcher after error
      setTimeout(() => {
        if (watcher) {
          watcher.close().then(() => {
            watcher = chokidar.watch(watchDir, {
              ignored: [
                /(^|[\/\\])\../,
                /node_modules/,
                /\.git/,
                /\.DS_Store/,
                /dist/,
                /\.vite/,
                /android/,
                /ios/,
                /\.(swp|swo|tmp)$/,
              ],
              persistent: true,
              ignoreInitial: true,
              usePolling: process.platform === 'win32',
              interval: 1000,
              binaryInterval: 1000,
              awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 200
              },
              depth: 10,
              followSymlinks: false
            })
            console.log('✅ Watcher restarted!')
          })
        }
      }, 2000)
    })
    .on('ready', () => {
      console.log('✅ Watch mode active! Edit files in src/ and they will auto-build & sync.')
      console.log(`📂 Watching: ${srcDir}`)
      console.log(`🖥️  Platform: ${process.platform}`)
      console.log(`🔍 Using polling: ${process.platform === 'win32' ? 'Yes' : 'No'}\n`)
    })
  
} catch (error) {
  console.error('❌ Failed to start watcher:', error.message)
  console.log('💡 Make sure the src/ directory exists!')
  process.exit(1)
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Stopping watch mode...')
  if (watcher) {
    await watcher.close()
  }
  if (buildTimeout) {
    clearTimeout(buildTimeout)
  }
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n\n👋 Stopping watch mode...')
  if (watcher) {
    await watcher.close()
  }
  if (buildTimeout) {
    clearTimeout(buildTimeout)
  }
  process.exit(0)
})










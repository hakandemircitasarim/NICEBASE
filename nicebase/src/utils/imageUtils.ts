/**
 * Check if browser supports WebP format
 */
export function supportsWebP(): boolean {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
}

/**
 * Check if browser supports AVIF format
 */
export function supportsAVIF(): Promise<boolean> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(false)
          return
        }
        const img = new Image()
        const url = URL.createObjectURL(blob)
        img.onload = () => { URL.revokeObjectURL(url); resolve(true) }
        img.onerror = () => { URL.revokeObjectURL(url); resolve(false) }
        img.src = url
      },
      'image/avif',
      0.5
    )
  })
}

/**
 * Compress image for mobile uploads with modern format support
 * Tries AVIF -> WebP -> JPEG based on browser support
 */
export async function compressImage(file: File, maxWidth: number = 1920, quality: number = 0.8): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const img = new Image()
      img.onload = async () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Calculate new dimensions
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        
        // Try AVIF first (best compression)
        const avifSupported = await supportsAVIF()
        if (avifSupported) {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result as string)
                reader.onerror = () => tryWebP()
                reader.readAsDataURL(blob)
              } else {
                tryWebP()
              }
            },
            'image/avif',
            quality
          )
          return
        }

        // Fallback to WebP
        const tryWebP = () => {
          if (supportsWebP()) {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const reader = new FileReader()
                  reader.onload = () => resolve(reader.result as string)
                  reader.onerror = () => tryJPEG()
                  reader.readAsDataURL(blob)
                } else {
                  tryJPEG()
                }
              },
              'image/webp',
              quality
            )
          } else {
            tryJPEG()
          }
        }

        // Final fallback to JPEG
        const tryJPEG = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Could not compress image'))
                return
              }
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            },
            'image/jpeg',
            quality
          )
        }

        // Start with AVIF or fallback chain
        if (!avifSupported) {
          tryWebP()
        }
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Get image file from camera or gallery
 */
export async function getImageFromCamera(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment' // Use back camera on mobile
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      resolve(file || null)
    }
    input.click()
  })
}














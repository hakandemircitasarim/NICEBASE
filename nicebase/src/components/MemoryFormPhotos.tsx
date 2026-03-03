import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, Camera, Images } from 'lucide-react'
import { hapticFeedback } from '../utils/haptic'
import { useState } from 'react'
import { useModalPresence } from '../hooks/useModalPresence'

interface MemoryFormPhotosProps {
  photos: string[]
  uploading?: boolean
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onPhotoClick: (index: number) => void
  onPhotoDelete: (index: number) => void
  maxPhotos?: number
}

export default function MemoryFormPhotos({
  photos,
  uploading = false,
  onPhotoUpload,
  onPhotoClick,
  onPhotoDelete,
  maxPhotos = 5,
}: MemoryFormPhotosProps) {
  const { t } = useTranslation()
  const [sheetOpen, setSheetOpen] = useState(false)
  useModalPresence(sheetOpen)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'))
    if (files.length > 0) {
      const fakeEvent = {
        target: { files: files as unknown as FileList }
      } as React.ChangeEvent<HTMLInputElement>
      onPhotoUpload(fakeEvent)
    }
  }

  return (
    <div>
      <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
        {t('photos')} ({photos.length}/{maxPhotos})
      </label>

      {photos.length < maxPhotos ? (
        <>
          {/* Mobile: bottom-sheet picker for camera vs gallery */}
          <button
            type="button"
            onClick={() => {
              if (uploading) return
              hapticFeedback('light')
              setSheetOpen(true)
            }}
            className="sm:hidden w-full h-14 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary hover:bg-primary/5 transition-all touch-manipulation flex items-center justify-center gap-3 disabled:opacity-60"
            disabled={uploading}
          >
            <Upload className="text-gray-400" size={22} />
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
              {uploading ? t('uploading', { defaultValue: 'Yükleniyor…' }) : t('uploadPhoto')}
            </span>
          </button>

          {/* Desktop/tablet: drag-drop area */}
          <motion.label
            whileHover={{ scale: uploading ? 1 : 1.02 }}
            whileTap={{ scale: uploading ? 1 : 0.98 }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDrop={(e) => {
              if (uploading) return
              handleDrop(e)
            }}
            className={`hidden sm:flex flex-col items-center justify-center w-full h-32 sm:h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-all group touch-manipulation ${
              uploading
                ? 'border-gray-200 dark:border-gray-700 opacity-70 cursor-not-allowed'
                : 'border-gray-300 dark:border-gray-600 hover:border-primary hover:bg-primary/5'
            }`}
          >
            <Upload className="mb-2 text-gray-400 group-hover:text-primary transition-colors" size={28} />
            <span className="text-xs sm:text-sm font-medium text-gray-500 group-hover:text-primary transition-colors text-center px-4">
              {uploading ? t('uploading', { defaultValue: 'Yükleniyor…' }) : t('uploadPhoto')}
            </span>
            <span className="text-xs text-gray-400 mt-1">{t('maxPhotos', { max: maxPhotos })}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onPhotoUpload}
              className="hidden"
              disabled={uploading}
            />
          </motion.label>

          {/* Sheet */}
          <AnimatePresence>
            {sheetOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSheetOpen(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-md z-[90] safe-area"
                />
                <motion.div
                  initial={{ y: '100%', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: '100%', opacity: 0 }}
                  transition={{ type: 'spring', damping: 35, stiffness: 420, mass: 0.8 }}
                  className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl z-[100] safe-area-bottom border-t border-gray-200 dark:border-gray-700"
                >
                  <div className="flex justify-center pt-4 pb-2">
                    <div className="w-14 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
                  </div>

                  <div className="px-5 pb-6">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {t('addPhoto', { defaultValue: 'Fotoğraf ekle' })}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {t('photoPickerHint', { defaultValue: 'Kamera veya galeriden seçim yap.' })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSheetOpen(false)}
                        className="icon-btn text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        aria-label={t('close')}
                      >
                        <X size={22} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <label className="w-full border-2 border-primary/25 dark:border-primary/35 rounded-2xl p-4 flex items-center gap-3 touch-manipulation cursor-pointer hover:border-primary transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                          <Camera className="text-primary" size={22} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 dark:text-gray-100">{t('camera', { defaultValue: 'Kamera' })}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{t('cameraHint', { defaultValue: 'Hemen çek ve ekle' })}</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => {
                            setSheetOpen(false)
                            onPhotoUpload(e)
                          }}
                          className="hidden"
                          disabled={uploading}
                        />
                      </label>

                      <label className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex items-center gap-3 touch-manipulation cursor-pointer hover:border-primary/60 transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <Images className="text-gray-600 dark:text-gray-300" size={22} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 dark:text-gray-100">{t('gallery', { defaultValue: 'Galeri' })}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{t('galleryHint', { defaultValue: 'Fotoğraf seç ve ekle' })}</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            setSheetOpen(false)
                            onPhotoUpload(e)
                          }}
                          className="hidden"
                          disabled={uploading}
                        />
                      </label>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      ) : (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-4 py-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('photoLimitReached', { defaultValue: 'Fotoğraf limitine ulaştın.' })}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('photoLimitHint', { defaultValue: 'Yeni fotoğraf eklemek için mevcutlardan birini sil.' })}
          </p>
        </div>
      )}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mt-3">
          {photos.map((photo, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative group"
            >
              <img
                src={photo}
                alt={t('photo') + ` ${idx + 1}`}
                loading="lazy"
                className="w-full h-28 object-cover rounded-xl cursor-pointer touch-manipulation bg-gray-100 dark:bg-gray-700"
                onError={(e) => {
                  const target = e.currentTarget
                  target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="20"%3E%F0%9F%93%B7%3C/text%3E%3C/svg%3E'
                  target.className = target.className + ' opacity-50'
                  target.alt = t('imageLoadError')
                }}
                onClick={() => {
                  hapticFeedback('light')
                  onPhotoClick(idx)
                }}
              />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation()
                  hapticFeedback('warning')
                  onPhotoDelete(idx)
                }}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg touch-manipulation"
              >
                <X size={14} />
              </motion.button>
            </motion.div>
          ))}
          {uploading && (
            <>
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={`sk-${i}`}
                  className="w-full h-28 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse"
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}







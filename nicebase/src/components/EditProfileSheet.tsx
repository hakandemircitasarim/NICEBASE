import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  X,
  Camera,
  User,
  MapPin,
  Cake,
  FileText,
  Trash2,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'
import { mapUserFromSupabase } from '../lib/userMapper'
import { hapticFeedback } from '../utils/haptic'
import { useModalPresence } from '../hooks/useModalPresence'

interface EditProfileSheetProps {
  onClose: () => void
}

export default function EditProfileSheet({ onClose }: EditProfileSheetProps) {
  const { t } = useTranslation()
  const { user, setUser } = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [birthday, setBirthday] = useState(user?.birthday || '')
  const [location, setLocation] = useState(user?.location || '')
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || '')
  const [avatarData, setAvatarData] = useState<string | null>(null) // new avatar base64
  const [saving, setSaving] = useState(false)

  useModalPresence(true)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleAvatarPick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Max 2MB
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('avatarTooLarge'))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string

      // Resize image to max 256px for efficiency
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxSize = 256
        let w = img.width
        let h = img.height

        if (w > h) {
          if (w > maxSize) {
            h = (h * maxSize) / w
            w = maxSize
          }
        } else {
          if (h > maxSize) {
            w = (w * maxSize) / h
            h = maxSize
          }
        }

        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, w, h)

        const resized = canvas.toDataURL('image/jpeg', 0.8)
        setAvatarPreview(resized)
        setAvatarData(resized)
        hapticFeedback('light')
      }
      img.src = result
    }
    reader.readAsDataURL(file)

    // Reset so same file can be picked again
    e.target.value = ''
  }

  const handleRemoveAvatar = () => {
    setAvatarPreview('')
    setAvatarData('') // empty string means "remove"
    hapticFeedback('light')
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)

    try {
      const updates: Record<string, unknown> = {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        birthday: birthday || null,
        location: location.trim() || null,
      }

      // Avatar: if changed, update it
      if (avatarData !== null) {
        updates.avatar_url = avatarData || null
      }

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)

      if (error) {
        // If columns don't exist yet, save locally
        if (
          error.message?.includes('column') ||
          error.code === '42703'
        ) {
          // Columns not in DB yet - save locally via store
          const updatedUser = {
            ...user,
            displayName: displayName.trim() || null,
            bio: bio.trim() || null,
            birthday: birthday || null,
            location: location.trim() || null,
            avatarUrl:
              avatarData !== null
                ? avatarData || null
                : user.avatarUrl,
          }
          setUser(updatedUser)
          // Also save to localStorage as fallback
          try {
            localStorage.setItem(
              `profile_${user.id}`,
              JSON.stringify({
                displayName: updatedUser.displayName,
                bio: updatedUser.bio,
                birthday: updatedUser.birthday,
                location: updatedUser.location,
                avatarUrl: updatedUser.avatarUrl,
              })
            )
          } catch {
            // ignore
          }
          hapticFeedback('success')
          toast.success(t('profileSaved'))
          onClose()
          return
        }
        throw error
      }

      // Fetch updated user from DB (explicit columns to avoid pulling large data)
      const { data: userData } = await supabase
        .from('users')
        .select('id, email, display_name, bio, avatar_url, birthday, location, is_premium, aiya_messages_used, aiya_messages_limit, weekly_summary_day, daily_reminder_time, language, theme, created_at')
        .eq('id', user.id)
        .single()

      if (userData) {
        setUser(mapUserFromSupabase(userData))
      }

      hapticFeedback('success')
      toast.success(t('profileSaved'))
      onClose()
    } catch (error) {
      hapticFeedback('error')
      toast.error(t('profileSaveError'))
      if (import.meta.env.DEV) {
        console.error('Profile save error:', error)
      }
    } finally {
      setSaving(false)
    }
  }

  const avatarLetter = displayName
    ? displayName.charAt(0).toUpperCase()
    : user?.email
      ? user.email.charAt(0).toUpperCase()
      : '?'

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-gray-50 dark:bg-gray-900 rounded-t-3xl shadow-2xl"
        style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gridTemplateColumns: 'minmax(0, 1fr)', maxHeight: '92vh', overflow: 'hidden' }}
      >
        {/* Row 1: Handle & Header (auto — cannot scroll) */}
        <div className="pt-3 pb-2 px-5">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {t('editProfile')}
            </h2>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center touch-manipulation hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Row 2: Content (1fr — sole scrollable area) */}
        <div className="overflow-y-auto overscroll-contain px-5 pb-8 pt-4" style={{ minHeight: 0 }}>
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-3">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-28 h-28 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-lg"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-lg">
                  <span className="text-4xl font-bold text-white">
                    {avatarLetter}
                  </span>
                </div>
              )}

              {/* Camera button */}
              <button
                onClick={handleAvatarPick}
                className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800 touch-manipulation hover:bg-primary-dark transition-colors"
              >
                <Camera size={18} />
              </button>
            </div>

            {avatarPreview && (
              <button
                onClick={handleRemoveAvatar}
                className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1 touch-manipulation"
              >
                <Trash2 size={14} />
                {t('removePhoto')}
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Form Fields */}
          <div className="space-y-5">
            {/* Display Name */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <User size={16} className="text-primary" />
                {t('displayName')}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('displayNamePlaceholder')}
                maxLength={50}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none touch-manipulation"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <FileText size={16} className="text-primary" />
                {t('bioLabel')}
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t('bioPlaceholder')}
                maxLength={200}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none touch-manipulation"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {bio.length}/200
              </p>
            </div>

            {/* Birthday */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <Cake size={16} className="text-primary" />
                {t('birthdayLabel')}
              </label>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none touch-manipulation"
              />
            </div>

            {/* Location */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <MapPin size={16} className="text-primary" />
                {t('locationLabel')}
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t('locationPlaceholder')}
                maxLength={100}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none touch-manipulation"
              />
            </div>
          </div>

          {/* Save Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-8 px-6 py-3.5 bg-primary text-white rounded-2xl font-bold text-base hover:bg-primary-dark transition-colors touch-manipulation shadow-lg shadow-primary/30 disabled:opacity-60"
          >
            {saving ? t('saving') : t('saveProfile')}
          </motion.button>
        </div>
      </motion.div>
    </>
  )
}

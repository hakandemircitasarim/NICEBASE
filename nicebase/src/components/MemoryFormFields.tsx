import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { AlertCircle, Sparkles, Smile, Heart, Lightbulb, TrendingUp, Mountain } from 'lucide-react'
import { MemoryCategory } from '../types'
import Select from './Select'
import RangeSlider from './RangeSlider'

interface MemoryFormFieldsProps {
  text: string
  category: MemoryCategory
  intensity: number
  textLength: number
  suggestingCategory: boolean
  categorySuggestion?: MemoryCategory | null
  error?: string
  onTextChange: (text: string) => void
  onTextBlur: () => void
  onTextFocus: (e: React.FocusEvent<HTMLTextAreaElement>) => void
  onCategoryChange: (category: MemoryCategory) => void
  onIntensityChange: (intensity: number) => void
}

export default function MemoryFormFields({
  text,
  category,
  intensity,
  textLength,
  suggestingCategory,
  categorySuggestion,
  error,
  onTextChange,
  onTextBlur,
  onTextFocus,
  onCategoryChange,
  onIntensityChange,
}: MemoryFormFieldsProps) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const minChars = 10
  const isMinOk = text.trim().length >= minChars

  const categoryOptions = useMemo(() => {
    return [
      { value: 'success', label: t('categories.success'), icon: <Sparkles size={18} /> },
      { value: 'peace', label: t('categories.peace'), icon: <Smile size={18} /> },
      { value: 'fun', label: t('categories.fun'), icon: <Heart size={18} /> },
      { value: 'love', label: t('categories.love'), icon: <Heart size={18} /> },
      { value: 'gratitude', label: t('categories.gratitude'), icon: <Heart size={18} /> },
      { value: 'inspiration', label: t('categories.inspiration'), icon: <Lightbulb size={18} /> },
      { value: 'growth', label: t('categories.growth'), icon: <TrendingUp size={18} /> },
      { value: 'adventure', label: t('categories.adventure'), icon: <Mountain size={18} /> },
    ]
  }, [t])

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    // Reset first so shrinking works too
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    autoResize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
            {t('text')} <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            {suggestingCategory && (
              <span className="text-xs text-primary animate-pulse">{t('suggestingCategory')}</span>
            )}
            <span className="text-xs text-gray-500">{textLength}</span>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          data-memory-textarea="true"
          value={text}
          onChange={(e) => {
            onTextChange(e.target.value)
            // Keep textarea height in sync for a smooth mobile typing experience
            autoResize()
          }}
          onBlur={onTextBlur}
          onFocus={onTextFocus}
          rows={4}
          className={`w-full px-4 py-3.5 sm:py-4 border-2 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none touch-manipulation leading-relaxed ${
            error
              ? 'border-red-500 focus:border-red-500'
              : 'border-gray-200 dark:border-gray-600 focus:border-primary'
          }`}
          placeholder={text ? '' : t('memoryTextPlaceholder')}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('memoryTextHelper', { defaultValue: 'Kısa ve net yaz. En az 10 karakter.' })}
          </p>
          <p className={`text-xs font-medium ${isMinOk ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {isMinOk
              ? t('looksGood', { defaultValue: 'Tamam' })
              : t('minChars', { defaultValue: `Min ${minChars}` })}
          </p>
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-sm text-red-500 flex items-center gap-2"
          >
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </motion.p>
        )}
      </div>

      <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-3 gap-3">
            <label className="block text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
              {t('category')}
            </label>
            {suggestingCategory ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-semibold">
                <Sparkles size={14} />
                {t('suggestingCategory')}
              </span>
            ) : categorySuggestion ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-semibold">
                <Sparkles size={14} />
                {t('aiSuggestion', { defaultValue: 'AI' })}: {t(`categories.${categorySuggestion}` as string)}
              </span>
            ) : null}
          </div>

          {/* Mobile-first category picker (bigger touch targets) */}
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            {categoryOptions.map((opt) => {
              const selected = opt.value === category
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onCategoryChange(opt.value as MemoryCategory)}
                  className={[
                    'touch-target w-full rounded-2xl border-2 px-3 py-3 flex items-center gap-2 justify-start text-sm font-semibold transition-colors touch-manipulation',
                    selected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200',
                  ].join(' ')}
                >
                  <span className={selected ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}>{opt.icon}</span>
                  <span className="truncate">{opt.label}</span>
                </button>
              )
            })}
          </div>

          {/* Desktop/tablet: keep Select */}
          <div className="hidden sm:block">
            <Select
              value={category}
              onChange={(val) => onCategoryChange(val as MemoryCategory)}
              placeholder={t('category')}
              options={categoryOptions}
            />
          </div>
        </div>

        <div>
          <RangeSlider
            value={intensity}
            min={1}
            max={10}
            step={1}
            onChange={onIntensityChange}
            label={t('intensity')}
            showValue={true}
          />
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{t('low', { defaultValue: 'Düşük' })}</span>
            <span>{t('high', { defaultValue: 'Yüksek' })}</span>
          </div>
        </div>
      </div>
    </>
  )
}







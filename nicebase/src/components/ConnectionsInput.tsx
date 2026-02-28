import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { dedupeConnections, parseConnectionTokens, cleanConnectionName, normalizeConnectionKey } from '../utils/connections'

interface ConnectionsInputProps {
  value: string
  onChange: (value: string) => void
  suggestions?: string[]
  placeholder?: string
  hint?: string
  error?: string
}

export default function ConnectionsInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  hint,
  error,
}: ConnectionsInputProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const chips = useMemo(() => {
    return dedupeConnections(parseConnectionTokens(value))
  }, [value])

  const [draft, setDraft] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  // If parent resets value, also reset the draft.
  useEffect(() => {
    if (!value) setDraft('')
  }, [value])

  const usedKeys = useMemo(() => new Set(chips.map(normalizeConnectionKey)), [chips])

  const filteredSuggestions = useMemo(() => {
    const q = cleanConnectionName(draft).toLocaleLowerCase()
    if (!q) return []
    return dedupeConnections(suggestions)
      .filter(s => !usedKeys.has(normalizeConnectionKey(s)))
      .filter(s => s.toLocaleLowerCase().includes(q))
      .slice(0, 6)
  }, [draft, suggestions, usedKeys])

  const commitTokens = (raw: string) => {
    const tokens = parseConnectionTokens(raw)
    if (tokens.length === 0) return

    const next = dedupeConnections([...chips, ...tokens])
    onChange(next.join(', '))
    setDraft('')
  }

  const removeChip = (chip: string) => {
    const chipKey = normalizeConnectionKey(chip)
    const next = chips.filter(c => normalizeConnectionKey(c) !== chipKey)
    onChange(next.join(', '))
    // Keep focus for fast editing
    inputRef.current?.focus()
  }

  return (
    <div>
      <div
        className={`w-full px-3 py-2.5 border-2 rounded-xl bg-white dark:bg-gray-700 transition-all outline-none touch-manipulation ${
          error
            ? 'border-red-500 focus-within:border-red-500'
            : 'border-gray-200 dark:border-gray-600 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex flex-wrap gap-2 items-center">
          {chips.map((chip) => (
            <span
              key={normalizeConnectionKey(chip)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 dark:bg-primary/20 text-primary font-semibold text-sm"
            >
              <span className="max-w-[220px] truncate">{chip}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeChip(chip)
                }}
                className="p-0.5 rounded-full hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
                aria-label={t('delete')}
              >
                <X size={14} />
              </button>
            </span>
          ))}

          <input
            ref={inputRef}
            value={draft}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false)
              if (draft.trim()) commitTokens(draft)
            }}
            onChange={(e) => {
              const v = e.target.value
              // If user typed separators, commit immediately.
              if (/[,\n;]/.test(v)) {
                commitTokens(v)
                return
              }
              setDraft(v)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (draft.trim()) commitTokens(draft)
              }
              if (e.key === ',' || e.key === ';') {
                e.preventDefault()
                if (draft.trim()) commitTokens(draft)
              }
              if (e.key === 'Backspace' && !draft && chips.length > 0) {
                // Remove last chip quickly
                e.preventDefault()
                removeChip(chips[chips.length - 1])
              }
            }}
            placeholder={chips.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[140px] bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400 py-1"
          />
        </div>
      </div>

      {hint && !error && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-500">
          {error}
        </p>
      )}

      <AnimatePresence>
        {isFocused && filteredSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="mt-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg border border-primary/20 dark:border-primary/30 rounded-2xl overflow-hidden shadow-2xl"
          >
            {filteredSuggestions.map((s, idx) => (
              <motion.button
                key={normalizeConnectionKey(s)}
                type="button"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                onMouseDown={(e) => {
                  // Prevent blur before click
                  e.preventDefault()
                }}
                onClick={() => {
                  commitTokens(s)
                  inputRef.current?.focus()
                }}
                className="w-full text-left px-4 py-3 hover:bg-primary/5 dark:hover:bg-primary/10 active:bg-primary/10 dark:active:bg-primary/20 transition-all touch-manipulation flex items-center gap-2 group"
              >
                <div className="w-2 h-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors flex-shrink-0" />
                <span className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">{s}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}







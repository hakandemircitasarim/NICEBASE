import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { X, Crown, Check, Sparkles } from 'lucide-react'
import { useStore } from '../store/useStore'
import { hapticFeedback } from '../utils/haptic'
import { purchaseService, type PurchasePlan } from '../services/purchaseService'
import { useModalPresence } from '../hooks/useModalPresence'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useBackButton } from '../hooks/useBackButton'

interface PaywallProps {
  onClose: () => void
}

// Benefit rows are static i18n keys — kept at module scope so the array
// identity is stable across renders.
const BENEFIT_KEYS = [
  'premiumBenefitUnlimitedAiya',
  'premiumBenefitPriority',
  'premiumBenefitSupport',
  'premiumBenefitFuture',
] as const

export default function Paywall({ onClose }: PaywallProps) {
  const { t } = useTranslation()
  const isPremium = useStore((s) => s.user)?.isPremium ?? false
  const plans = purchaseService.getPlans()
  // Default the selection to the most popular plan when present, else the first.
  const [selectedPlanId, setSelectedPlanId] = useState<PurchasePlan['id']>(
    plans.find((p) => p.badgeKey === 'mostPopular')?.id ?? plans[0]?.id ?? 'monthly'
  )
  const [busy, setBusy] = useState(false)

  const sheetRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useModalPresence(true)
  // iOS-safe scroll lock with proper restore (replaces manual body.overflow).
  useBodyScrollLock(true)
  useEscapeKey(onClose, true)
  useBackButton(() => {
    onClose()
    return true
  }, true)

  // Move focus into the sheet on open (so Tab/Escape work immediately and screen
  // readers announce the dialog) and restore focus to the opener on close.
  // Mirrors ImageModal.tsx. Escape itself is handled by useEscapeKey above.
  useEffect(() => {
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) || null
    const timer = window.setTimeout(() => sheetRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(timer)
      previouslyFocusedRef.current?.focus?.()
    }
  }, [])

  // Trap Tab within the sheet so focus can't escape to the page behind it.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const root = sheetRef.current
    if (!root) return
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>('button:not([disabled]),[tabindex]:not([tabindex="-1"])')
    )
    if (focusables.length === 0) {
      e.preventDefault()
      root.focus()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement as HTMLElement | null
    if (e.shiftKey) {
      if (!active || active === first || !root.contains(active)) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (!active || active === last || !root.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  // Map a non-success PurchaseResult reason to the right localized toast so the
  // user always gets honest feedback (never a fake success).
  const reportFailure = (
    reason: 'coming-soon' | 'web-unavailable' | 'cancelled' | 'error' | undefined,
    fallbackKey: 'purchaseFailed' | 'purchaseRestoreFailed'
  ) => {
    hapticFeedback('warning')
    if (reason === 'web-unavailable') {
      toast(t('purchaseNotAvailableWeb'))
    } else if (reason === 'coming-soon') {
      toast(t('purchaseComingSoon'))
    } else if (reason === 'cancelled') {
      // User dismissed the store sheet — no error toast needed.
    } else {
      toast.error(t(fallbackKey))
    }
  }

  const handlePurchase = async () => {
    if (busy) return
    setBusy(true)
    try {
      hapticFeedback('light')
      const result = await purchaseService.purchase(selectedPlanId)
      if (result.ok) {
        hapticFeedback('success')
        toast.success(t('premiumThankYou'))
        onClose()
      } else {
        reportFailure(result.reason, 'purchaseFailed')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async () => {
    if (busy) return
    setBusy(true)
    try {
      hapticFeedback('light')
      const result = await purchaseService.restore()
      if (result.ok) {
        hapticFeedback('success')
        toast.success(t('purchaseRestored'))
        onClose()
      } else {
        reportFailure(result.reason, 'purchaseRestoreFailed')
      }
    } finally {
      setBusy(false)
    }
  }

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
        ref={sheetRef}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('premium')}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] flex flex-col bg-gray-50 dark:bg-gray-900 rounded-t-3xl shadow-2xl"
      >
        {/* Handle & Header */}
        <div className="flex-shrink-0 pt-3 pb-2 px-5">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {t('premium')}
            </h2>
            <button
              onClick={onClose}
              aria-label={t('close')}
              className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center touch-manipulation hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-5 pt-2"
          style={{ paddingBottom: 'calc(2rem + var(--safe-area-inset-bottom, 0px))' }}
        >
          {isPremium ? (
            /* Celebratory active state */
            <div className="flex flex-col items-center text-center py-10">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                className="w-24 h-24 rounded-3xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 mb-6"
              >
                <Crown size={44} className="text-white" />
              </motion.div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {t('premiumActive')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-xs">
                {t('premiumThankYou')}
              </p>
              <button
                onClick={onClose}
                className="w-full max-w-xs px-6 py-3.5 gradient-primary text-white rounded-2xl font-bold text-base shadow-lg shadow-primary/30 touch-manipulation"
              >
                {t('close')}
              </button>
            </div>
          ) : (
            <>
              {/* Hero */}
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 mb-4">
                  <Crown size={38} className="text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {t('premiumTitle')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1.5 max-w-sm">
                  {t('premiumHeadline')}
                </p>
              </div>

              {/* Benefits */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 space-y-3 mb-6">
                {BENEFIT_KEYS.map((key) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Check size={16} className="text-primary" />
                    </div>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {t(key)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Plan selection */}
              <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 px-1">
                {t('choosePlan')}
              </h4>
              <div className="space-y-3 mb-6">
                {plans.map((plan) => {
                  const selected = plan.id === selectedPlanId
                  return (
                    <button
                      key={plan.id}
                      onClick={() => {
                        hapticFeedback('light')
                        setSelectedPlanId(plan.id)
                      }}
                      className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all touch-manipulation ${
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/40'
                      }`}
                    >
                      {/* Radio */}
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          selected
                            ? 'border-primary'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {selected && (
                          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                        )}
                      </span>

                      {/* Title + badge */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {t(plan.titleKey)}
                          </span>
                          {plan.badgeKey && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full gradient-primary text-white text-[11px] font-bold">
                              <Sparkles size={11} />
                              {t(plan.badgeKey)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Price + period */}
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-gray-900 dark:text-gray-100">
                          {plan.price}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t(plan.period)}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Primary purchase CTA */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handlePurchase}
                disabled={busy}
                className="w-full px-6 py-4 gradient-primary text-white rounded-2xl font-bold text-base shadow-lg shadow-primary/30 touch-manipulation disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Crown size={18} />
                {t('premiumCta')}
              </motion.button>

              {/* Restore */}
              <button
                onClick={handleRestore}
                disabled={busy}
                className="w-full mt-3 py-2.5 text-sm font-semibold text-primary hover:text-primary-dark transition-colors touch-manipulation disabled:opacity-60"
              >
                {t('restorePurchases')}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </>
  )
}

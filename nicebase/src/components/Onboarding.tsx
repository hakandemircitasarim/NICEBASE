import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Archive, Heart, MessageCircle, BarChart3, Trophy } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useModalPresence } from '../hooks/useModalPresence'

interface OnboardingProps {
  onComplete: () => void
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { t } = useTranslation()
  const { language } = useStore()
  const [step, setStep] = useState(0)
  useModalPresence(true)

  const steps = [
    {
      icon: Sparkles,
      title: t('welcomeToNicebase'),
      description: t('onboardingWelcome'),
    },
    {
      icon: Archive,
      title: t('vault'),
      description: t('onboardingVault'),
    },
    {
      icon: Heart,
      title: t('relationshipSaver'),
      description: t('onboardingRelationship'),
    },
    {
      icon: MessageCircle,
      title: t('aiya'),
      description: t('onboardingAiya'),
    },
    {
      icon: BarChart3,
      title: t('statistics'),
      description: t('onboardingStatistics'),
    },
    {
      icon: Trophy,
      title: t('badgesAndAchievements'),
      description: t('onboardingAchievements'),
    },
  ]

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1)
    } else {
      onComplete()
    }
  }

  const skip = () => {
    onComplete()
  }

  const Icon = steps[step].icon

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="relative p-8">
            <button
              onClick={skip}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-6">
              <motion.div
                key={step}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="mb-4"
              >
                <Icon className="mx-auto text-primary" size={64} />
              </motion.div>
              <h2 className="text-2xl font-bold mb-2">{steps[step].title}</h2>
              <p className="text-gray-600 dark:text-gray-400">{steps[step].description}</p>
            </div>

            <div className="flex gap-2 justify-center mb-6">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 rounded-full transition-all ${
                    idx === step ? 'bg-primary w-8' : 'bg-gray-300 dark:bg-gray-600 w-2'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-3">
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                >
                  {t('back')}
                </button>
              )}
              <button
                onClick={nextStep}
                className="flex-1 px-4 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-xl transition-all touch-manipulation"
              >
                {step === steps.length - 1 
                  ? t('getStarted')
                  : t('nextStep')}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}


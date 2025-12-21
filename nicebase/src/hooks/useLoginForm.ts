import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface UseLoginFormReturn {
  // Form state
  email: string
  password: string
  confirmPassword: string
  acceptedTerms: boolean
  passwordStrength: number
  showPassword: boolean
  showConfirmPassword: boolean
  errors: Record<string, string>
  
  // Setters
  setEmail: (email: string) => void
  setPassword: (password: string) => void
  setConfirmPassword: (password: string) => void
  setAcceptedTerms: (accepted: boolean) => void
  setShowPassword: (show: boolean) => void
  setShowConfirmPassword: (show: boolean) => void
  
  // Validation
  isValidEmail: (email: string) => boolean
  calculatePasswordStrength: (pwd: string) => number
  getStrengthColor: (strength: number) => string
  getStrengthText: (strength: number) => string
  validateForm: (isSignUp: boolean) => { isValid: boolean; errors: Record<string, string> }
  clearErrors: () => void
  setError: (field: string, message: string) => void
  clearError: (field: string) => void
}

/**
 * Custom hook for managing login/signup form state and validation
 */
export function useLoginForm(): UseLoginFormReturn {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Email validation
  const isValidEmail = useCallback((email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }, [])

  // Password strength calculation
  const calculatePasswordStrength = useCallback((pwd: string): number => {
    let strength = 0
    if (pwd.length >= 6) strength += 1
    if (pwd.length >= 8) strength += 1
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength += 1
    if (/\d/.test(pwd)) strength += 1
    if (/[^a-zA-Z\d]/.test(pwd)) strength += 1
    return strength
  }, [])

  // Update password strength when password changes
  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(password))
  }, [password, calculatePasswordStrength])

  const getStrengthColor = useCallback((strength: number) => {
    if (strength <= 1) return 'bg-red-500'
    if (strength <= 2) return 'bg-orange-500'
    if (strength <= 3) return 'bg-yellow-500'
    if (strength <= 4) return 'bg-blue-500'
    return 'bg-green-500'
  }, [])

  const getStrengthText = useCallback((strength: number) => {
    if (strength <= 1) return t('passwordStrength.veryWeak')
    if (strength <= 2) return t('passwordStrength.weak')
    if (strength <= 3) return t('passwordStrength.fair')
    if (strength <= 4) return t('passwordStrength.good')
    return t('passwordStrength.strong')
  }, [t])

  const validateForm = useCallback((isSignUp: boolean): { isValid: boolean; errors: Record<string, string> } => {
    const newErrors: Record<string, string> = {}

    if (!isValidEmail(email)) {
      newErrors.email = t('invalidEmail')
    }

    if (password.length < 6) {
      newErrors.password = t('passwordTooShort')
    }

    if (isSignUp) {
      if (password !== confirmPassword) {
        newErrors.confirmPassword = t('passwordsDoNotMatch')
      }

      if (!acceptedTerms) {
        newErrors.terms = t('acceptTerms')
      }
    }

    setErrors(newErrors)
    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors,
    }
  }, [email, password, confirmPassword, acceptedTerms, isValidEmail, t])

  const clearErrors = useCallback(() => {
    setErrors({})
  }, [])

  const setError = useCallback((field: string, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }))
  }, [])

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }, [])

  return {
    email,
    password,
    confirmPassword,
    acceptedTerms,
    passwordStrength,
    showPassword,
    showConfirmPassword,
    errors,
    setEmail,
    setPassword,
    setConfirmPassword,
    setAcceptedTerms,
    setShowPassword,
    setShowConfirmPassword,
    isValidEmail,
    calculatePasswordStrength,
    getStrengthColor,
    getStrengthText,
    validateForm,
    clearErrors,
    setError,
    clearError,
  }
}





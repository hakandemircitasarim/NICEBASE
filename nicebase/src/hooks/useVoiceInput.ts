import { useState, useRef, useCallback, useEffect } from 'react'
import type { WindowWithCapacitor } from '../types/capacitor'

interface UseVoiceInputOptions {
  onResult?: (text: string) => void
  onError?: (error: Error) => void
  language?: string
}

export function useVoiceInput({ onResult, onError, language = 'tr-TR' }: UseVoiceInputOptions = {}) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isListeningRef = useRef(isListening)
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)

  // Keep refs in sync with latest values
  useEffect(() => { isListeningRef.current = isListening }, [isListening])
  useEffect(() => { onResultRef.current = onResult }, [onResult])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  // Check if Speech Recognition is supported
  const checkSupport = useCallback(() => {
    if (typeof window === 'undefined') {
      setIsSupported(false)
      return false
    }

    const SpeechRecognition = window.SpeechRecognition || (window as WindowWithCapacitor).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSupported(false)
      return false
    }

    setIsSupported(true)
    return true
  }, [])

  // Initialize recognition - uses refs to avoid re-creation when callbacks change
  const initRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null

    const SpeechRecognition = window.SpeechRecognition || (window as WindowWithCapacitor).webkitSpeechRecognition
    if (!SpeechRecognition) return null

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = language

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }

      if (finalTranscript) {
        onResultRef.current?.(finalTranscript.trim())
      } else if (interimTranscript) {
        onResultRef.current?.(interimTranscript)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false)
      const error = new Error(event.error === 'no-speech'
        ? 'No speech detected'
        : event.error === 'aborted'
        ? 'Speech recognition aborted'
        : `Speech recognition error: ${event.error}`)
      onErrorRef.current?.(error)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    return recognition
  }, [language])

  const startListening = useCallback(() => {
    if (!checkSupport()) {
      onErrorRef.current?.(new Error('Speech recognition is not supported in this browser'))
      return
    }

    if (isListeningRef.current) {
      stopListening()
      return
    }

    const recognition = initRecognition()
    if (!recognition) {
      onErrorRef.current?.(new Error('Failed to initialize speech recognition'))
      return
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch (error) {
      setIsListening(false)
      onErrorRef.current?.(error instanceof Error ? error : new Error('Failed to start speech recognition'))
    }
  }, [checkSupport, initRecognition])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  // Check support on mount + cleanup recognition on unmount
  useEffect(() => {
    checkSupport()
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
    }
  }, [checkSupport])

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
  }
}

// Type declarations for Speech Recognition API
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

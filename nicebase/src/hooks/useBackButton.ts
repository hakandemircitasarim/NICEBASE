import { useEffect, useRef } from 'react'
import { pushBackButtonHandler } from '../utils/capacitor'

/**
 * Register an Android hardware-back handler while `active` is true.
 *
 * Handlers run before lower (page-level) ones; return `true` to CONSUME the
 * event (stop it propagating / closing the app), `false` to let the next
 * handler down handle it. The handler auto-unregisters on unmount or when
 * `active` becomes false, restoring the handler beneath it — so overlays and
 * forms can safely layer on top of Layout's page navigation handler.
 *
 * No-op on web (the native back-button event only fires on Android).
 */
export function useBackButton(handler: () => boolean, active = true) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!active) return
    const unregister = pushBackButtonHandler(() => handlerRef.current())
    return unregister
  }, [active])
}

import { useCallback, useMemo, useState } from 'react'

export type ConfirmDialogType = 'danger' | 'warning' | 'info'

export type ConfirmDialogOptions = {
  title: string
  message: string
  type?: ConfirmDialogType
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
}

type ConfirmDialogState = {
  isOpen: boolean
  title: string
  message: string
  type?: ConfirmDialogType
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
}

const noop = () => {}

/**
 * Centralizes confirm dialog state + open/close logic.
 * Keeps UI behavior the same; only removes repeated boilerplate.
 */
export function useConfirmDialog() {
  const [dialog, setDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    confirmText: undefined,
    cancelText: undefined,
    onConfirm: noop,
  })

  const closeConfirm = useCallback(() => {
    setDialog((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const openConfirm = useCallback((options: ConfirmDialogOptions) => {
    setDialog({
      isOpen: true,
      title: options.title,
      message: options.message,
      type: options.type ?? 'warning',
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      onConfirm: options.onConfirm,
    })
  }, [])

  const confirmDialogProps = useMemo(
    () => ({
      isOpen: dialog.isOpen,
      title: dialog.title,
      message: dialog.message,
      type: dialog.type,
      confirmText: dialog.confirmText,
      cancelText: dialog.cancelText,
      onConfirm: dialog.onConfirm,
      onClose: closeConfirm,
    }),
    [
      dialog.isOpen,
      dialog.message,
      dialog.onConfirm,
      dialog.title,
      dialog.type,
      dialog.confirmText,
      dialog.cancelText,
      closeConfirm,
    ]
  )

  return {
    openConfirm,
    closeConfirm,
    confirmDialogProps,
    isConfirmOpen: dialog.isOpen,
  }
}








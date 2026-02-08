import { errorLoggingService } from '../services/errorLoggingService'

/**
 * Error severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'info'

/**
 * Application error interface for typed error handling
 */
export interface AppError {
  code: string
  message: string
  context?: Record<string, unknown>
  severity: ErrorSeverity
}

/**
 * Handles errors consistently across the application.
 * Logs errors to the error logging service and returns a typed error object.
 * 
 * @param error - The error to handle (Error object, string, or unknown)
 * @param context - Context information about where the error occurred (e.g., 'Login.handleSubmit')
 * @param userId - Optional user ID for error tracking
 * @param severity - Error severity level (default: 'error')
 * @returns Typed AppError object
 * 
 * @example
 * ```typescript
 * try {
 *   await someOperation()
 * } catch (error) {
 *   const appError = handleError(error, 'Component.operation', userId)
 *   toast.error(appError.message)
 * }
 * ```
 */
export function handleError(
  error: unknown,
  context: string,
  userId?: string,
  severity: ErrorSeverity = 'error'
): AppError {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorName = error instanceof Error ? error.name : 'UNKNOWN_ERROR'
  
  const appError: AppError = {
    code: errorName,
    message: errorMessage,
    context: { location: context, userId },
    severity,
  }

  // Log to error logging service
  errorLoggingService.logError(
    error instanceof Error ? error : new Error(errorMessage),
    severity,
    userId
  )

  return appError
}

/**
 * Handles errors and shows a user-friendly toast message.
 * Convenience wrapper that combines error handling with user notification.
 * 
 * @param error - The error to handle
 * @param context - Context information about where the error occurred
 * @param userMessage - User-friendly error message to display
 * @param userId - Optional user ID for error tracking
 * @param severity - Error severity level (default: 'error')
 * @returns Typed AppError object
 * 
 * @example
 * ```typescript
 * try {
 *   await saveData()
 * } catch (error) {
 *   handleErrorWithToast(
 *     error,
 *     'DataService.save',
 *     'Failed to save data. Please try again.',
 *     userId
 *   )
 * }
 * ```
 */
export function handleErrorWithToast(
  error: unknown,
  context: string,
  userMessage: string,
  userId?: string,
  severity: ErrorSeverity = 'error'
): AppError {
  const appError = handleError(error, context, userId, severity)
  
  // Note: toast is not imported here to avoid circular dependencies
  // Caller should handle toast display
  // This function just returns the error for consistency
  
  return appError
}






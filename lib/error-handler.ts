/**
 * Error handling utilities for SafeRoute
 * Provides consistent error messages and logging across the application
 */

/**
 * Handles errors and returns a user-friendly message
 * @param error - The error to handle
 * @param fallback - Default message if error type cannot be determined
 * @returns User-friendly error message
 */
export function handleError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Network/Fetch errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('ネットワーク') ||
      message.includes('failed to fetch') ||
      message.includes('connection')
    ) {
      return 'ネットワークエラーが発生しました。インターネット接続を確認してください。'
    }

    // Authentication/Login errors
    if (
      message.includes('auth') ||
      message.includes('login') ||
      message.includes('認証') ||
      message.includes('unauthorized') ||
      message.includes('unauthenticated') ||
      message.includes('session')
    ) {
      return '認証エラーが発生しました。再度ログインしてください。'
    }

    // Database/Supabase errors
    if (
      message.includes('database') ||
      message.includes('supabase') ||
      message.includes('db') ||
      message.includes('postgres') ||
      message.includes('sql')
    ) {
      return 'データベースエラーが発生しました。しばらく経ってから再度お試しください。'
    }

    // Return the original error message if it's meaningful
    if (error.message && error.message.length > 0) {
      return error.message
    }
  }

  // Default/Fallback for unexpected errors
  return fallback || '予期しないエラーが発生しました。'
}

/**
 * Logs errors with context for debugging
 * @param error - The error to log
 * @param context - Context string describing where the error occurred
 */
export function logError(error: unknown, context: string): void {
  const timestamp = new Date().toISOString()

  if (error instanceof Error) {
    console.error(`[${timestamp}] [${context}] Error:`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    })
  } else {
    console.error(`[${timestamp}] [${context}] Unknown error:`, error)
  }
}

/**
 * Type guard to check if an error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error
}

/**
 * Creates a standardized error response object
 */
export function createErrorResponse(error: unknown, fallback: string) {
  return {
    success: false,
    error: handleError(error, fallback),
  }
}

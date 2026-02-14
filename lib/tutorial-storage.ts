const TUTORIAL_STORAGE_KEY = 'pathguard-tutorial-progress'
const TUTORIAL_VERSION = "2.0"

export function shouldShowTutorial(): boolean {
  try {
    const stored = localStorage.getItem(TUTORIAL_STORAGE_KEY)
    if (!stored) {
      // v1 key migration
      const legacyCompleted = localStorage.getItem('pathguard-tutorial-completed')
      if (legacyCompleted) {
        localStorage.removeItem('pathguard-tutorial-completed')
        return true
      }
      return true
    }
    const parsed = JSON.parse(stored)
    const storedMajor = parseInt(parsed.version?.split('.')[0] ?? '0', 10)
    const currentMajor = parseInt(TUTORIAL_VERSION.split('.')[0], 10)
    return storedMajor < currentMajor
  } catch {
    return true
  }
}

export function markTutorialCompleted(): void {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify({
    version: TUTORIAL_VERSION,
    completedAt: new Date().toISOString(),
  }))
}

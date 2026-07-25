const STORAGE_KEY = 'scanny-dark-mode'

export function readDarkMode(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? Boolean(JSON.parse(saved)) : false
  } catch {
    return false
  }
}

/** Apply the same dark-mode class on html + body so every page shares tokens. */
export function applyDarkMode(enabled: boolean) {
  document.documentElement.classList.toggle('dark-mode', enabled)
  document.documentElement.classList.toggle('dark', enabled)
  document.body.classList.toggle('dark-mode', enabled)
  document.body.classList.toggle('dark', enabled)
}

export function persistDarkMode(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled))
  applyDarkMode(enabled)
}

export function initThemeFromStorage() {
  applyDarkMode(readDarkMode())
}

export function toggleDarkMode() {
  const next = !readDarkMode()
  persistDarkMode(next)
  return next
}

/** Press D to toggle theme (ignored while typing in fields). */
export function bindThemeHotkey() {
  function handleKeyPress(e: KeyboardEvent) {
    if (e.key !== 'd' && e.key !== 'D') return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const target = e.target
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return
    }
    e.preventDefault()
    toggleDarkMode()
  }
  window.addEventListener('keydown', handleKeyPress)
  return () => window.removeEventListener('keydown', handleKeyPress)
}

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

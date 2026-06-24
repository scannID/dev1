import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import LandingPage from './LandingPage'
import EventTicketPage from './EventTicket'

type View = 'landing' | 'app' | 'ticket'

function Root() {
  const [view, setView] = useState<View>('landing')
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('scanny-dark-mode')
    return saved ? JSON.parse(saved) : false
  })

  // Toggle dark mode with 'D' key
  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      if (e.key === 'd' || e.key === 'D') {
        // Don't toggle if user is typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }
        setDarkMode((prev: boolean) => {
          const newMode = !prev
          localStorage.setItem('scanny-dark-mode', JSON.stringify(newMode))
          return newMode
        })
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode')
    } else {
      document.body.classList.remove('dark-mode')
    }
  }, [darkMode])

  if (view === 'app')    return <App />
  if (view === 'ticket') return <EventTicketPage onBack={() => setView('landing')} />
  return (
    <LandingPage
      onGetStarted={() => setView('app')}
      onCreateTicket={() => setView('ticket')}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

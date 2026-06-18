import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import LandingPage from './LandingPage'
import EventTicketPage from './EventTicket'

type View = 'landing' | 'app' | 'ticket'

function Root() {
  const [view, setView] = useState<View>('landing')

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

import { useNavigate, useLocation } from 'react-router-dom'
import { useUserId } from '../hooks/useUserId'
import MemoryForm from '../components/MemoryForm'
import type { DailyQuestion } from '../types'

interface LocationState {
  dailyQuestion?: DailyQuestion | null
}

export default function AddMemory() {
  const navigate = useNavigate()
  const location = useLocation()
  const userId = useUserId()

  // Daily question can be passed via navigation state from Home page
  const dailyQuestion = (location.state as LocationState | null)?.dailyQuestion ?? null

  // Go back if there's history, otherwise land on Home — /add-memory can be the
  // first navigation of a session (PWA shortcut, notification tap, refresh), in
  // which case navigate(-1) would be a no-op and strand the user on the form.
  const close = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/', { replace: true })
  }

  return (
    <MemoryForm
      presentation="screen"
      onClose={close}
      onSave={close}
      userId={userId}
      dailyQuestion={dailyQuestion}
    />
  )
}

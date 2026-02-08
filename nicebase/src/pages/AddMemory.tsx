import { useNavigate, useLocation } from 'react-router-dom'
import { useUserId } from '../hooks/useUserId'
import MemoryForm from '../components/MemoryForm'

export default function AddMemory() {
  const navigate = useNavigate()
  const location = useLocation()
  const userId = useUserId()

  // Daily question can be passed via navigation state from Home page
  const dailyQuestion = (location.state as any)?.dailyQuestion ?? null

  return (
    <MemoryForm
      presentation="screen"
      onClose={() => navigate(-1)}
      onSave={() => {
        navigate(-1)
      }}
      userId={userId}
      dailyQuestion={dailyQuestion}
    />
  )
}

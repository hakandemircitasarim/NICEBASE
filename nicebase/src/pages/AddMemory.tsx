import { useNavigate } from 'react-router-dom'
import { useUserId } from '../hooks/useUserId'
import MemoryForm from '../components/MemoryForm'

export default function AddMemory() {
  const navigate = useNavigate()
  const userId = useUserId()

  return (
    <MemoryForm
      presentation="screen"
      onClose={() => navigate(-1)}
      onSave={() => {
        // Navigate back to where user came from (Home/Vault).
        // Data refresh is handled by the destination page hooks.
        navigate(-1)
      }}
      userId={userId}
      initialMode="simple"
      enableHistoryClose={false}
    />
  )
}



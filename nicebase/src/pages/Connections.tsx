import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ChevronLeft, Search, Pencil, Trash2, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmationDialog from '../components/ConfirmationDialog'
import { useUserId } from '../hooks/useUserId'
import { useMemories } from '../hooks/useMemories'
import { memoryService } from '../services/memoryService'
import { useModalPresence } from '../hooks/useModalPresence'
import {
  buildConnectionDisplayMap,
  cleanConnectionName,
  dedupeConnections,
  normalizeConnectionKey,
} from '../utils/connections'

type ConnectionStat = {
  key: string
  name: string
  count: number
  lastUsed: string | null
}

export default function Connections() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const userId = useUserId()
  const { memories, loading, refreshMemories } = useMemories(userId)

  const [query, setQuery] = useState('')
  const [renameTarget, setRenameTarget] = useState<ConnectionStat | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ConnectionStat | null>(null)
  const [busy, setBusy] = useState(false)
  useModalPresence(!!renameTarget)

  const stats = useMemo<ConnectionStat[]>(() => {
    const allConnections = memories.flatMap(m => m.connections)
    const displayMap = buildConnectionDisplayMap(allConnections)
    const map = new Map<string, ConnectionStat>()

    for (const [key, name] of displayMap.entries()) {
      map.set(key, { key, name, count: 0, lastUsed: null })
    }

    for (const memory of memories) {
      for (const raw of memory.connections) {
        const k = normalizeConnectionKey(raw)
        const entry = map.get(k) ?? { key: k, name: cleanConnectionName(raw), count: 0, lastUsed: null }
        entry.count += 1
        if (!entry.lastUsed || new Date(memory.date) > new Date(entry.lastUsed)) {
          entry.lastUsed = memory.date
        }
        map.set(k, entry)
      }
    }

    const list = Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })

    const q = query.trim().toLocaleLowerCase()
    if (!q) return list
    return list.filter(s => s.name.toLocaleLowerCase().includes(q))
  }, [memories, query])

  const openRename = (stat: ConnectionStat) => {
    setRenameTarget(stat)
    setRenameValue(stat.name)
  }

  const closeRename = () => {
    setRenameTarget(null)
    setRenameValue('')
  }

  const applyRename = async () => {
    if (!renameTarget) return
    const newName = cleanConnectionName(renameValue)
    if (!newName) return

    const oldKey = renameTarget.key
    const newKey = normalizeConnectionKey(newName)

    setBusy(true)
    try {
      // Update every memory where any connection matches oldKey (normalized).
      const affected = memories.filter(m => m.connections.some(c => normalizeConnectionKey(c) === oldKey))
      for (const m of affected) {
        const next = dedupeConnections(
          m.connections.map(c => (normalizeConnectionKey(c) === oldKey ? newName : c))
        )
        await memoryService.update(m.id, { connections: next })
      }

      // If rename turns into an existing key, this effectively "merges" them.
      if (oldKey !== newKey) {
        toast.success(t('connectionRenamed'))
      } else {
        toast.success(t('connectionUpdated'))
      }

      closeRename()
      await refreshMemories()
    } catch {
      toast.error(t('saveErrorRetry'))
    } finally {
      setBusy(false)
    }
  }

  const applyDelete = async () => {
    if (!deleteTarget) return
    const targetKey = deleteTarget.key

    setBusy(true)
    try {
      const affected = memories.filter(m => m.connections.some(c => normalizeConnectionKey(c) === targetKey))
      for (const m of affected) {
        const next = dedupeConnections(m.connections.filter(c => normalizeConnectionKey(c) !== targetKey))
        await memoryService.update(m.id, { connections: next })
      }
      toast.success(t('connectionDeleted'))
      setDeleteTarget(null)
      await refreshMemories()
    } catch {
      toast.error(t('saveErrorRetry'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/profile')}
          className="icon-btn bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary/40 touch-manipulation"
          aria-label={t('back')}
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold">{t('connections')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('connectionsHubDescription')}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-5 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchConnectionsPlaceholder')}
            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none touch-manipulation"
          />
        </div>
      </div>

      {stats.length === 0 ? (
        <div className="text-center py-16 px-4">
          <Users className="mx-auto text-gray-400 dark:text-gray-500 mb-4" size={64} />
          <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
            {t('noConnections')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-base mb-6">
            {t('noConnectionsDescription')}
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/vault?action=add')}
            className="px-6 py-3 gradient-primary text-white rounded-xl font-semibold hover:shadow-lg transition-all touch-manipulation"
          >
            {t('addMemory')}
          </motion.button>
        </div>
      ) : (
        <div className="space-y-3">
          {stats.map((c) => (
            <motion.button
              key={c.key}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/relationship-saver?connection=${encodeURIComponent(c.name)}`)}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-5 hover:border-primary/40 transition-all touch-manipulation text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Users className="text-primary" size={20} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('connectionMemoryCount', { count: c.count })}
                    {c.lastUsed ? ` • ${t('lastUsed')}: ${new Date(c.lastUsed).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="row-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openRename(c)
                    }}
                    className="icon-btn border border-gray-200 dark:border-gray-700 hover:border-primary/40 hover:bg-gray-50 dark:hover:bg-gray-700 touch-manipulation"
                    aria-label={t('renameConnection')}
                    disabled={busy}
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget(c)
                    }}
                    className="icon-btn border border-gray-200 dark:border-gray-700 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 touch-manipulation text-red-600 dark:text-red-400"
                    aria-label={t('deleteConnection')}
                    disabled={busy}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Rename Dialog */}
      {renameTarget && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeRename}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {t('renameConnection')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('renameConnectionDescription')}
              </p>
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder={t('renameConnectionPlaceholder')}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none touch-manipulation"
                autoFocus
                disabled={busy}
              />
              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={closeRename}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                  disabled={busy}
                >
                  {t('cancel')}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={applyRename}
                  className="flex-1 px-4 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold transition-colors touch-manipulation shadow-lg disabled:opacity-60"
                  disabled={busy || !cleanConnectionName(renameValue)}
                >
                  {t('save')}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={applyDelete}
        title={t('deleteConnection')}
        message={t('deleteConnectionConfirm', { name: deleteTarget?.name || '' })}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        type="danger"
      />
    </div>
  )
}






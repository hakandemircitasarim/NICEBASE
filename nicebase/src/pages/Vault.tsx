import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { memoryService } from '../services/memoryService'
import { Memory } from '../types'
import MemoryForm from '../components/MemoryForm'
import QuickMemoryForm from '../components/QuickMemoryForm'
import LoadingSpinner from '../components/LoadingSpinner'
import { SkeletonMemoryCard } from '../components/Skeleton'
import ImageModal from '../components/ImageModal'
import ConfirmationDialog from '../components/ConfirmationDialog'
import GestureHint from '../components/GestureHint'
import SuccessAnimation from '../components/SuccessAnimation'
import VaultHeader from '../components/VaultHeader'
import VaultFilters from '../components/VaultFilters'
import VaultEmptyState from '../components/VaultEmptyState'
import VaultMemoryList from '../components/VaultMemoryList'
import { useUserId } from '../hooks/useUserId'
import { useMemories } from '../hooks/useMemories'
import { useMemoryFilters } from '../hooks/useMemoryFilters'
import { useNotifications } from '../hooks/useNotifications'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
// QuickMemoryDraft no longer needed here (QuickMemoryForm handles in-place "full add" expansion)

export default function Vault() {
  const { t } = useTranslation()
  const userId = useUserId()
  const { memories, loading, refreshMemories } = useMemories(userId)
  const { showSuccess, showError, hapticFeedback } = useNotifications()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showForm, setShowForm] = useState(false)
  const [showQuickForm, setShowQuickForm] = useState(false)
  const [editingMemory, setEditingMemory] = useState<Memory | undefined>()
  const [selectedMemories, setSelectedMemories] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [displayCount, setDisplayCount] = useState(20)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const { openConfirm, confirmDialogProps } = useConfirmDialog()
  const [showSwipeHint, setShowSwipeHint] = useState(false)
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const {
    filteredMemories,
    searchQuery,
    selectedCategory,
    selectedLifeArea,
    sortBy,
    dateRange,
    searchConnections,
    setSearchQuery,
    setSelectedCategory,
    setSelectedLifeArea,
    setSortBy,
    setDateRange,
    setSearchConnections,
    clearFilters,
  } = useMemoryFilters(memories)

  useEffect(() => {
    // Show swipe hint on first visit if memories exist
    const hasSeenSwipeHint =
      localStorage.getItem('hasSeenHint_swipe') || localStorage.getItem('hasSeenSwipeHint')
    if (!hasSeenSwipeHint) {
      setTimeout(() => {
        setShowSwipeHint(true)
      }, 2000)
    }
    const action = searchParams.get('action')
    if (action === 'add') {
      setEditingMemory(undefined)
      setShowForm(false)
      setShowQuickForm(true)
      return
    }
    // If the URL no longer requests add-mode, ensure the quick form isn't stuck open.
    // This fixes "back doesn't work" when user navigates back/forward.
    if (action !== 'add' && showQuickForm) {
      setShowQuickForm(false)
    }
  }, [searchParams, showQuickForm])

  const handleSave = useCallback(async (newMemory?: Memory) => {
    try {
      // Refresh to sync with server (memoryService.create already saved to IndexedDB)
      await refreshMemories()
      // Show success animation
      setSuccessMessage(newMemory ? t('memorySaved') : t('memoryUpdated'))
      setShowSuccessAnimation(true)
      setTimeout(() => setShowSuccessAnimation(false), 2000)
    } catch (error) {
      hapticFeedback('error')
      showError(t('saveErrorRetry'))
    }
  }, [refreshMemories, t, hapticFeedback, showError])

  const handleDelete = useCallback((id: string) => {
    openConfirm({
      title: t('deleteMemory'),
      message: t('deleteMemoryConfirm'),
      type: 'danger',
      onConfirm: async () => {
        try {
          await memoryService.delete(id)
          hapticFeedback('success')
          showSuccess(t('memoryDeleted'))
          setSuccessMessage(t('memoryDeleted'))
          setShowSuccessAnimation(true)
          setTimeout(() => setShowSuccessAnimation(false), 2000)
          // Refresh to sync with server
          await refreshMemories()
        } catch (error) {
          hapticFeedback('error')
          showError(t('deleteError'))
        }
      },
    })
  }, [t, hapticFeedback, showSuccess, showError, refreshMemories])

  const handleBulkDelete = useCallback(() => {
    if (selectedMemories.size === 0) return
    openConfirm({
      title: t('deleteMemories'),
      message: t('deleteMemoriesConfirm', { count: selectedMemories.size }),
      type: 'danger',
      onConfirm: async () => {
        const selectedIds = Array.from(selectedMemories)

        try {
          await Promise.all(selectedIds.map(id => memoryService.delete(id)))
          hapticFeedback('success')
          showSuccess(t('memoriesDeleted', { count: selectedMemories.size }))
          setSelectedMemories(new Set())
          setBulkMode(false)
          // Refresh to sync with server
          await refreshMemories()
        } catch (error) {
          hapticFeedback('error')
          showError(t('bulkDeleteError'))
        }
      },
    })
  }, [selectedMemories, t, hapticFeedback, showSuccess, showError, refreshMemories])

  const toggleMemorySelection = useCallback((id: string) => {
    setSelectedMemories(prev => {
      const newSelected = new Set(prev)
      if (newSelected.has(id)) {
        newSelected.delete(id)
      } else {
        newSelected.add(id)
      }
      return newSelected
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedMemories(new Set(filteredMemories.map(m => m.id)))
  }, [filteredMemories])

  const clearSelection = useCallback(() => {
    setSelectedMemories(new Set())
  }, [])

  const handleToggleBulkMode = useCallback(() => {
    hapticFeedback('light')
    setBulkMode(true)
  }, [hapticFeedback])

  const handleCancelBulk = useCallback(() => {
    setBulkMode(false)
    setSelectedMemories(new Set())
  }, [])

  const showAddDetailsToast = useCallback((memory: Memory) => {
    toast.custom((tToast) => (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-4 max-w-sm w-full">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="font-bold text-gray-900 dark:text-gray-100">{t('memorySaved')}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('addDetailsPrompt')}</p>
          </div>
          <button
            onClick={() => toast.dismiss(tToast.id)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => {
              toast.dismiss(tToast.id)
              setEditingMemory(memory)
              setShowForm(true)
            }}
            className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold transition-colors touch-manipulation"
          >
            {t('addDetails')}
          </button>
          <button
            onClick={() => toast.dismiss(tToast.id)}
            className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
          >
            {t('done')}
          </button>
        </div>
      </div>
    ), { duration: 5000 })
  }, [t])

  const handleAddMemory = useCallback(() => {
    hapticFeedback('light')
    setEditingMemory(undefined)
    setShowQuickForm(true)
  }, [hapticFeedback])

  const handleEdit = useCallback((memory: Memory) => {
    setEditingMemory(memory)
    setShowForm(true)
  }, [])

  const handleImageClick = useCallback((images: string[], idx: number) => {
    setSelectedImages(images)
    setSelectedImageIndex(idx)
    setShowImageModal(true)
  }, [])

  const handleCloseForm = useCallback(() => {
    setShowForm(false)
    setEditingMemory(undefined)
    setSearchParams({})
  }, [setSearchParams])

  const handleCloseImageModal = useCallback(() => {
    setShowImageModal(false)
  }, [])

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true)
    hapticFeedback('light')
    await new Promise(resolve => setTimeout(resolve, 300))
    setDisplayCount(prev => Math.min(prev + 20, filteredMemories.length))
    setIsLoadingMore(false)
  }, [filteredMemories.length, hapticFeedback])

  const handleClearFilters = useCallback(() => {
    hapticFeedback('light')
    clearFilters()
  }, [clearFilters, hapticFeedback])

  // Removed: if (!user) return null - user is now optional for offline usage
  // userId is already defined at the top of the component

  return (
    <div 
      className="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8 py-8 sm:py-10"
    >
      <VaultHeader
        bulkMode={bulkMode}
        selectedCount={selectedMemories.size}
        onToggleBulkMode={handleToggleBulkMode}
        onSelectAll={selectAll}
        onBulkDelete={handleBulkDelete}
        onCancelBulk={handleCancelBulk}
        onAddMemory={handleAddMemory}
      />

      <VaultFilters
        memories={memories}
        searchQuery={searchQuery}
        selectedCategory={selectedCategory}
        selectedLifeArea={selectedLifeArea}
        sortBy={sortBy}
        dateRange={dateRange}
        searchConnections={searchConnections}
        onSearchChange={setSearchQuery}
        onCategoryChange={setSelectedCategory}
        onLifeAreaChange={setSelectedLifeArea}
        onSortChange={setSortBy}
        onDateRangeChange={(start, end) => setDateRange({ start, end })}
        onConnectionsChange={setSearchConnections}
      />

      {filteredMemories.length === 0 && !loading ? (
        <VaultEmptyState
          hasFilters={Boolean(
            searchQuery ||
            selectedCategory !== 'all' ||
            selectedLifeArea !== 'all' ||
            dateRange.start ||
            dateRange.end ||
            searchConnections.length > 0
          )}
          onClearFilters={handleClearFilters}
          onAddMemory={handleAddMemory}
        />
      ) : (
        <VaultMemoryList
          loading={loading}
          memories={filteredMemories}
          displayCount={displayCount}
          isLoadingMore={isLoadingMore}
          bulkMode={bulkMode}
          selectedMemories={selectedMemories}
          onLoadMore={handleLoadMore}
          onToggleSelection={toggleMemorySelection}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onImageClick={handleImageClick}
        />
      )}

      {showForm && (
        <MemoryForm
          memory={editingMemory}
          onClose={handleCloseForm}
          onSave={handleSave}
          userId={userId}
        />
      )}

      {showQuickForm && (
        <QuickMemoryForm
          userId={userId}
          onClose={() => {
            setShowQuickForm(false)
            // If quick form was opened via ?action=add, clear it so browser back/forward behaves.
            setSearchParams({})
          }}
          onSave={async (newMemory) => {
            try {
              await refreshMemories()
              showAddDetailsToast(newMemory)
            } catch {
              // noop
            }
          }}
        />
      )}


      {showImageModal && (
        <ImageModal
          images={selectedImages}
          currentIndex={selectedImageIndex}
          onClose={handleCloseImageModal}
        />
      )}

      <ConfirmationDialog
        {...confirmDialogProps}
      />

      {showSwipeHint && filteredMemories.length > 0 && (
        <GestureHint
          type="swipe"
          onDismiss={() => {
            setShowSwipeHint(false)
            localStorage.setItem('hasSeenHint_swipe', 'true')
            localStorage.setItem('hasSeenSwipeHint', 'true') // backward compat
          }}
        />
      )}

      {/* Success Animation */}
      <AnimatePresence>
        {showSuccessAnimation && (
          <SuccessAnimation
            message={successMessage}
            onComplete={() => setShowSuccessAnimation(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}


import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { memoryService } from '../services/memoryService'
import { Memory } from '../types'
import MemoryForm from '../components/MemoryForm'
import LoadingSpinner from '../components/LoadingSpinner'
import ImageModal from '../components/ImageModal'
import ConfirmationDialog from '../components/ConfirmationDialog'
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

export default function Vault() {
  const { t } = useTranslation()
  const userId = useUserId()
  const { memories, loading, error, refreshMemories } = useMemories(userId)
  const { showSuccess, showError, hapticFeedback } = useNotifications()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showForm, setShowForm] = useState(false)
  const [editingMemory, setEditingMemory] = useState<Memory | undefined>()
  const [selectedMemories, setSelectedMemories] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [displayCount, setDisplayCount] = useState(20)
  // True once an initial load has begun. useMemories starts with loading=false
  // before its effect kicks in, so on the very first paint memories=[] and
  // loading=false would briefly satisfy the empty-state condition and flash
  // the "no memories" illustration before skeletons appear. Gating on this
  // flag keeps the loading/skeleton state as the first thing the user sees.
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false)
  const { openConfirm, confirmDialogProps } = useConfirmDialog()
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

  // Mark that a real load has started (or finished) so the empty state can't
  // flash before the first skeleton frame.
  useEffect(() => {
    if (loading || error || memories.length > 0) {
      setHasAttemptedLoad(true)
    }
  }, [loading, error, memories.length])

  // Reset the "load more" window whenever the active filters/search/sort/
  // dateRange/connections change, so a deep expansion from a previous view
  // doesn't carry into a freshly filtered (possibly smaller) result set.
  useEffect(() => {
    setDisplayCount(20)
  }, [searchQuery, selectedCategory, selectedLifeArea, sortBy, dateRange.start, dateRange.end, searchConnections])

  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'add') {
      setEditingMemory(undefined)
      setShowForm(true)
      return
    }
    if (action !== 'add' && showForm && !editingMemory) {
      // Don't close if user opened form manually for editing
    }
  }, [searchParams])

  const handleSave = useCallback(async (newMemory?: Memory) => {
    try {
      await refreshMemories()
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
          await refreshMemories()
        } catch (error) {
          hapticFeedback('error')
          showError(t('deleteError'))
        }
      },
    })
  }, [t, hapticFeedback, showSuccess, showError, refreshMemories, openConfirm])

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
          await refreshMemories()
        } catch (error) {
          hapticFeedback('error')
          showError(t('bulkDeleteError'))
        }
      },
    })
  }, [selectedMemories, t, hapticFeedback, showSuccess, showError, refreshMemories, openConfirm])

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

  const handleAddMemory = useCallback(() => {
    hapticFeedback('light')
    setEditingMemory(undefined)
    setShowForm(true)
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

  const handleLoadMore = useCallback(() => {
    // Data is fully client-side — bump the window immediately, no fake latency.
    hapticFeedback('light')
    setDisplayCount(prev => Math.min(prev + 20, filteredMemories.length))
  }, [filteredMemories.length, hapticFeedback])

  const handleClearFilters = useCallback(() => {
    hapticFeedback('light')
    clearFilters()
  }, [clearFilters, hapticFeedback])

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8 py-8 sm:py-10">
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

      {error && !loading ? (
        // Distinct error state — a failed load must not masquerade as
        // "no memories yet". Offer a retry instead of an "add memory" CTA.
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 sm:py-20 px-4"
        >
          <div className="w-24 h-24 sm:w-32 sm:h-32 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 dark:text-red-400" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">
            {t('error')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-6 max-w-md leading-relaxed">
            {t('memoriesLoadError')}
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => refreshMemories()}
            className="gradient-primary text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all touch-manipulation min-h-[48px] flex items-center justify-center gap-2"
          >
            <RefreshCw size={20} />
            {t('tryAgain')}
          </motion.button>
        </motion.div>
      ) : filteredMemories.length === 0 && !loading && hasAttemptedLoad ? (
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
          loading={loading || !hasAttemptedLoad}
          memories={filteredMemories}
          displayCount={displayCount}
          isLoadingMore={false}
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

      {showImageModal && (
        <ImageModal
          images={selectedImages}
          currentIndex={selectedImageIndex}
          onClose={handleCloseImageModal}
        />
      )}

      <ConfirmationDialog {...confirmDialogProps} />

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

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { memoryService } from '../services/memoryService'
import { Memory } from '../types'
import MemoryForm from '../components/MemoryForm'
import LoadingSpinner from '../components/LoadingSpinner'
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

export default function Vault() {
  const { t } = useTranslation()
  const userId = useUserId()
  const { memories, loading, refreshMemories } = useMemories(userId)
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
    const hasSeenSwipeHint =
      localStorage.getItem('hasSeenHint_swipe') || localStorage.getItem('hasSeenSwipeHint')
    if (!hasSeenSwipeHint) {
      setTimeout(() => setShowSwipeHint(true), 2000)
    }
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

      {showImageModal && (
        <ImageModal
          images={selectedImages}
          currentIndex={selectedImageIndex}
          onClose={handleCloseImageModal}
        />
      )}

      <ConfirmationDialog {...confirmDialogProps} />

      {showSwipeHint && filteredMemories.length > 0 && (
        <GestureHint
          type="swipe"
          onDismiss={() => {
            setShowSwipeHint(false)
            localStorage.setItem('hasSeenHint_swipe', 'true')
            localStorage.setItem('hasSeenSwipeHint', 'true')
          }}
        />
      )}

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

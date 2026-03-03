import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Memory } from '../types'
import i18n from '../i18n'
import { isNative } from '../utils/capacitor'

/**
 * Convert blob to base64 data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Downloads a blob — tries multiple strategies for compatibility:
 * 1. Web Share API with files (native Android)
 * 2. Anchor element download (web browsers)
 * 3. Data URL in new window (fallback for WebViews)
 */
async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  // Strategy 1: Web Share API with files (works well on Android native)
  if (isNative() || navigator.share) {
    try {
      const file = new File([blob], filename, { type: blob.type })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename })
        return
      }
    } catch (err) {
      // User cancelled or API not available — try next strategy
      if (err instanceof Error && err.name === 'AbortError') return
    }
  }

  // Strategy 2: Anchor element download (standard web)
  try {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    // Small delay before cleanup to ensure download starts
    setTimeout(() => {
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }, 1000)

    // On native, anchor click may silently fail — check if we need fallback
    if (!isNative()) return
  } catch {
    // Anchor approach failed — try data URL fallback
  }

  // Strategy 3: Data URL fallback (works in most WebViews)
  try {
    const dataUrl = await blobToDataUrl(blob)
    const win = window.open(dataUrl, '_blank')
    if (!win) {
      // Popup blocked — try direct location change for data URL
      window.location.href = dataUrl
    }
  } catch {
    throw new Error('Export failed: could not download file')
  }
}

export const exportService = {
  async exportToPDF(memories: Memory[], filename: string = 'nicebase-export') {
    const doc = new jsPDF()
    const lang = i18n.language || 'tr'
    const dateLocale = lang === 'tr' ? 'tr-TR' : 'en-US'
    
    // Title
    doc.setFontSize(20)
    doc.text(i18n.t('exportReportTitle'), 14, 20)
    
    // Date
    doc.setFontSize(10)
    doc.text(`${i18n.t('exportCreatedDate')}: ${new Date().toLocaleDateString(dateLocale)}`, 14, 30)
    doc.text(`${i18n.t('exportTotalMemories')}: ${memories.length}`, 14, 35)
    
    // Table
    const tableData = memories.map(m => [
      new Date(m.date).toLocaleDateString(dateLocale),
      m.text.substring(0, 50) + (m.text.length > 50 ? '...' : ''),
      m.category,
      m.intensity.toString(),
      m.lifeArea,
      m.isCore ? i18n.t('yes') : i18n.t('no'),
    ])
    
    autoTable(doc, {
      head: [[i18n.t('exportDate'), i18n.t('exportText'), i18n.t('exportCategory'), i18n.t('exportIntensity'), i18n.t('exportLifeArea'), i18n.t('exportCore')]],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 107, 53] },
    })
    
    const pdfBlob = doc.output('blob')
    await downloadBlob(pdfBlob, `${filename}.pdf`)
  },

  async exportToCSV(memories: Memory[], filename: string = 'nicebase-export') {
    const lang = i18n.language || 'tr'
    const dateLocale = lang === 'tr' ? 'tr-TR' : 'en-US'
    const headers = [i18n.t('exportDate'), i18n.t('exportText'), i18n.t('exportCategory'), i18n.t('exportIntensity'), i18n.t('exportConnections'), i18n.t('exportLifeArea'), i18n.t('exportCore'), i18n.t('exportPhotoCount')]
    
    // Escape a CSV field: wrap in quotes and escape internal quotes.
    // Also defuse formula injection by prefixing dangerous characters with a tab.
    const escapeCSV = (value: string): string => {
      let safe = value
      // Defuse formula injection: prefix with tab if starts with =, +, -, @, |, %
      if (/^[=+\-@|%]/.test(safe)) {
        safe = '\t' + safe
      }
      // Always wrap in double quotes and escape internal quotes
      return `"${safe.replace(/"/g, '""')}"`
    }

    const rows = memories.map(m => [
      escapeCSV(new Date(m.date).toLocaleDateString(dateLocale)),
      escapeCSV(m.text),
      escapeCSV(m.category),
      escapeCSV(m.intensity.toString()),
      escapeCSV(m.connections.join('; ')),
      escapeCSV(m.lifeArea),
      escapeCSV(m.isCore ? i18n.t('yes') : i18n.t('no')),
      escapeCSV(m.photos.length.toString()),
    ])

    const csvContent = [
      headers.map(h => escapeCSV(h)).join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    await downloadBlob(blob, `${filename}.csv`)
  },

  async exportToJSON(memories: Memory[], filename: string = 'nicebase-export') {
    const dataStr = JSON.stringify(memories, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    await downloadBlob(blob, `${filename}.json`)
  },
}


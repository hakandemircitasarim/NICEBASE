import { Memory } from '../types'
import i18n from '../i18n'
import { isNative } from '../utils/capacitor'
import { formatMemoryDate } from '../utils/dateFormat'

/**
 * Localized, multi-category cell value. Counts EVERY tagged category so
 * multi-tagged memories aren't under-reported, falling back to the deprecated
 * single `category` only when the array is empty/missing. Each value is
 * localized via the same i18n keys the app UI uses (categories.<key>).
 */
function formatCategoryCell(m: Memory): string {
  const cats = m.categories && m.categories.length > 0 ? m.categories : [m.category]
  return cats.map(c => i18n.t(`categories.${c}`)).join(', ')
}

/** Localized life-area cell value, matching how the UI renders it. */
function formatLifeAreaCell(m: Memory): string {
  return i18n.t(`lifeAreas.${m.lifeArea}`)
}

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
 * Persists/exports a blob for the user. Platform-split so it actually delivers a
 * file on every target instead of silently no-op'ing on native (the old
 * 3-strategy web-only fallthrough always resolved successfully even when nothing
 * reached the device, so callers showed a false "exported" toast).
 *
 * - Web: anchor `download` on an object URL (the reliable browser path).
 * - Native (Capacitor): write to the Documents directory via @capacitor/filesystem,
 *   then open the system share sheet via @capacitor/share so the user can save/send
 *   it. A cancelled share is NOT a failure (the file is already on disk).
 *
 * THROWS on a genuine failure so the caller's catch can show an error toast
 * instead of a false success.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (!isNative()) {
    // Web: standard anchor download.
    const url = URL.createObjectURL(blob)
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      // Revoke after a tick so the download has a chance to start.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    return
  }

  // Native: write the file to Documents, then share it.
  const dataUrl = await blobToDataUrl(blob)
  const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl

  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const writeResult = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  })

  // Surface the file through the share sheet. If sharing is unavailable or the
  // user dismisses it, the file is already saved to Documents — not a failure.
  try {
    const { Share } = await import('@capacitor/share')
    await Share.share({
      title: filename,
      url: writeResult.uri,
      dialogTitle: filename,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
    // Share failed but the file was written — swallow so the export still counts
    // as successful (the file lives in Documents).
  }
}

export const exportService = {
  async exportToPDF(memories: Memory[], filename: string = 'nicebase-export') {
    // Load the heavy PDF libs on demand so they're not pulled into the Profile
    // route chunk (jspdf + autotable are ~250KB+).
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ])
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
      formatMemoryDate(m.date, dateLocale),
      m.text.substring(0, 50) + (m.text.length > 50 ? '...' : ''),
      formatCategoryCell(m),
      m.intensity.toString(),
      formatLifeAreaCell(m),
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
      escapeCSV(formatMemoryDate(m.date, dateLocale)),
      escapeCSV(m.text),
      escapeCSV(formatCategoryCell(m)),
      escapeCSV(m.intensity.toString()),
      escapeCSV(m.connections.join('; ')),
      escapeCSV(formatLifeAreaCell(m)),
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


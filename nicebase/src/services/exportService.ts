import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Memory } from '../types'
import i18n from '../i18n'
import { isNative } from '../utils/capacitor'

/**
 * Downloads a blob — on native Android uses share sheet (since anchor-click
 * downloads don't work inside Capacitor WebView), on web uses a hidden anchor.
 */
async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (isNative()) {
    // On native platforms, convert blob to data-URL and share via Web Share API
    // which Android supports natively inside WebView.
    try {
      const file = new File([blob], filename, { type: blob.type })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename })
        return
      }
    } catch {
      // Web Share API not available or user cancelled — fall through to anchor approach
    }
  }

  // Web fallback (also works on some Android WebViews)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
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


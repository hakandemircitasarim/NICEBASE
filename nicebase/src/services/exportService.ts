import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Memory } from '../types'
import i18n from '../i18n'

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
    
    doc.save(`${filename}.pdf`)
  },

  async exportToCSV(memories: Memory[], filename: string = 'nicebase-export') {
    const lang = i18n.language || 'tr'
    const dateLocale = lang === 'tr' ? 'tr-TR' : 'en-US'
    const headers = [i18n.t('exportDate'), i18n.t('exportText'), i18n.t('exportCategory'), i18n.t('exportIntensity'), i18n.t('exportConnections'), i18n.t('exportLifeArea'), i18n.t('exportCore'), i18n.t('exportPhotoCount')]
    
    const rows = memories.map(m => [
      new Date(m.date).toLocaleDateString(dateLocale),
      `"${m.text.replace(/"/g, '""')}"`, // Escape quotes
      m.category,
      m.intensity.toString(),
      m.connections.join('; '),
      m.lifeArea,
      m.isCore ? i18n.t('yes') : i18n.t('no'),
      m.photos.length.toString(),
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}.csv`
    link.click()
  },

  async exportToJSON(memories: Memory[], filename: string = 'nicebase-export') {
    const dataStr = JSON.stringify(memories, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.json`
    link.click()
  },
}


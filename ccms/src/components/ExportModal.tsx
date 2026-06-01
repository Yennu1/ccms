import { useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExportModalProps {
  title: string
  columns: string[]
  rows: (string | number | null | undefined)[][]
  filename: string
  onClose: () => void
}

type ExportFormat = 'csv' | 'excel' | 'pdf'

// ─── Icons ────────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CsvIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="16" height="16" rx="3" fill="#DCFCE7" />
      <path d="M6 10.5C6 11.88 7.12 13 8.5 13s2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5M13 7.5v5" stroke="#15803D" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function ExcelIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="16" height="16" rx="3" fill="#DCFCE7" />
      <path d="M6 7.5L10 12.5M10 7.5L6 12.5M13 7.5v5" stroke="#15803D" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function PdfIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="16" height="16" rx="3" fill="#FEE2E2" />
      <path d="M6 7h3a1.5 1.5 0 0 1 0 3H6V7ZM6 10h3.5M6 10v3M14 7v6" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SpinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="7" cy="7" r="5.5" stroke="#D1D5DB" strokeWidth="1.5" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#4F6BED" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function ExportOption({ icon, label, sub, loading, onClick }: {
  icon: React.ReactNode; label: string; sub: string; loading: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '11px 14px', borderRadius: 8, border: '0.5px solid var(--dm-border)',
        background: 'var(--dm-bg-card)', cursor: loading ? 'not-allowed' : 'pointer',
        textAlign: 'left', transition: 'background 0.1s, border-color 0.1s',
        opacity: loading ? 0.7 : 1,
      }}
      onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'var(--dm-bg-muted)'; e.currentTarget.style.borderColor = 'var(--dm-border-strong)' } }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--dm-bg-card)'; e.currentTarget.style.borderColor = 'var(--dm-border)' }}
    >
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: '#111827' }}>{label}</div>
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11.5, color: '#9CA3AF', marginTop: 1 }}>{sub}</div>
      </div>
      {loading && <SpinIcon />}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExportModal({ title, columns, rows, filename, onClose }: ExportModalProps) {
  const [loading, setLoading] = useState<ExportFormat | null>(null)

  function exportCsv() {
    setLoading('csv')
    const csv = Papa.unparse({ fields: columns, data: rows.map(r => r.map(v => v ?? '')) })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${filename}.csv`; a.click()
    URL.revokeObjectURL(url)
    setLoading(null)
    onClose()
  }

  function exportExcel() {
    setLoading('excel')
    const ws = XLSX.utils.aoa_to_sheet([columns, ...rows.map(r => r.map(v => v ?? ''))])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31))
    XLSX.writeFile(wb, `${filename}.xlsx`)
    setLoading(null)
    onClose()
  }

  async function exportPdf() {
    setLoading('pdf')
    const doc = new jsPDF({ orientation: rows[0]?.length > 6 ? 'landscape' : 'portrait' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(title, 14, 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(107, 114, 128)
    doc.text(`Generated ${new Date().toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 23)
    autoTable(doc, {
      startY: 28,
      head: [columns],
      body: rows.map(r => r.map(v => v === null || v === undefined ? '' : String(v))),
      styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
      headStyles: { fillColor: [27, 35, 82], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      tableLineColor: [229, 231, 235],
      tableLineWidth: 0.3,
    })
    doc.save(`${filename}.pdf`)
    setLoading(null)
    onClose()
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={onClose}
      >
        <div
          style={{ background: 'var(--dm-bg-card)', borderRadius: 12, padding: 24, width: 380, border: '0.5px solid var(--dm-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--dm-text-ink)' }}>
              Export: {title}
            </span>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 4, borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <XIcon />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ExportOption
              icon={<CsvIcon />}
              label="Export as CSV"
              sub="Comma-separated — opens in Excel or Sheets"
              loading={loading === 'csv'}
              onClick={exportCsv}
            />
            <ExportOption
              icon={<ExcelIcon />}
              label="Export as Excel"
              sub=".xlsx with formatted columns"
              loading={loading === 'excel'}
              onClick={exportExcel}
            />
            <ExportOption
              icon={<PdfIcon />}
              label="Export as PDF"
              sub="Formatted table with header"
              loading={loading === 'pdf'}
              onClick={exportPdf}
            />
          </div>
        </div>
      </div>
    </>
  )
}

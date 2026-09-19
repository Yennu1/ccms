import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CellDef, RowInput, Styles } from 'jspdf-autotable'

// ─────────────────────────────────────────────────────────────────────────────
// Income & Expenditure Account — PDF export
//
// Renders the church's real accounting statement layout (as used on the
// hand-prepared quarterly/annual sheets), NOT a generic table dump:
//
//   PARTICULARS | <one column per month> | TOTAL
//
//   B/F ............................. (optional)
//   INCOME .......................... (section header, spans all columns)
//     <income categories>
//   GRAND TOTAL ..................... (income)
//   EXPENDITURE ..................... (section header, spans all columns)
//     <group name> .................. (optional sub-header)
//       <categories>
//     TOTAL ......................... (group sub-total)
//   GRAND TOTAL ..................... (expenditure)
//
// This sits alongside the generic ExportModal (CSV / Excel / PDF) — it does not
// replace it.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * One printed line of the statement. Any entry of `monthlyActuals` and `total`
 * may be null — a null renders as a BLANK cell, never "0", so a category with
 * no activity in a month looks empty on the page.
 */
export interface ReportLineItem {
  particulars: string
  monthlyActuals: (number | null)[]   // one entry per month in the report period
  total: number | null
}

/**
 * A block of expenditure categories. `groupName: null` means a flat list —
 * the categories are printed directly with no sub-header and no sub-total row.
 */
export interface ExpenditureGroup {
  groupName: string | null
  categories: ReportLineItem[]
  groupTotal: ReportLineItem
}

export interface IncomeExpenditureReportData {
  churchName: string
  reportTitle: string            // e.g. "INCOME AND EXPENDITURE ACCOUNT FOR 1ST QUARTER 2026"
  monthLabels: string[]          // e.g. ["JANUARY","FEBRUARY","MARCH"], length 1 to 12
  broughtForward?: number | null // optional B/F row before INCOME
  income: {
    categories: ReportLineItem[]
    grandTotal: ReportLineItem
  }
  expenditure: {
    groups: ExpenditureGroup[]   // a single group with groupName: null covers the flat case
    grandTotal: ReportLineItem
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NAVY: [number, number, number] = [27, 35, 82]          // #1B2352
const SECTION_FILL: [number, number, number] = [225, 227, 232]
const GROUP_FILL: [number, number, number] = [242, 243, 245]
const TOTAL_FILL: [number, number, number] = [248, 249, 250]
const BORDER: [number, number, number] = [160, 165, 175]
const INK: [number, number, number] = [17, 24, 39]           // #111827

const MARGIN = 14

// Source sheets are written to 2 decimal places with no currency symbol, so the
// column reads as a clean accounting figure. Change here to alter every number.
const DECIMALS = 2

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Accounting number: thousands separators, no currency symbol.
 * null / undefined / NaN → blank cell (deliberately not "0").
 */
function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('en-US', {
    minimumFractionDigits: DECIMALS,
    maximumFractionDigits: DECIMALS,
  })
}

/** A line item rendered as one table row. `bold` is used for the total rows. */
function lineRow(item: ReportLineItem, monthCount: number, bold: boolean): RowInput {
  const actuals = Array.from({ length: monthCount }, (_, i) => fmt(item.monthlyActuals[i]))
  const styles: Partial<Styles> = bold
    ? {
        fontStyle: 'bold',
        fillColor: TOTAL_FILL,
        lineWidth: { top: 0.3, bottom: 0.3, left: 0.1, right: 0.1 },
        lineColor: BORDER,
      }
    : {}
  return [
    { content: item.particulars, styles: { ...styles, halign: 'left' } },
    ...actuals.map(a => ({ content: a, styles })),
    { content: fmt(item.total), styles },
  ]
}

/** A bold banner row spanning the full table width (INCOME / EXPENDITURE / group name). */
function bannerRow(label: string, colCount: number, fill: [number, number, number]): RowInput {
  const cell: CellDef = {
    content: label,
    colSpan: colCount,
    styles: {
      fontStyle: 'bold',
      fillColor: fill,
      halign: 'left',
      textColor: INK,
    },
  }
  return [cell]
}

// ─── Document builder ────────────────────────────────────────────────────────

/**
 * Builds the jsPDF document without saving it. Exported so the layout can be
 * rendered and inspected outside the browser (tests, previews).
 */
export function buildIncomeExpenditureDoc(data: IncomeExpenditureReportData): jsPDF {
  const monthCount = data.monthLabels.length
  const colCount = monthCount + 2          // PARTICULARS + months + TOTAL

  // Wide reports need landscape; the type scale shrinks as months are added so
  // a 12-month statement still fits within one page width.
  const orientation = monthCount <= 3 ? 'portrait' : 'landscape'
  const fontSize = monthCount <= 3 ? 9 : monthCount <= 6 ? 8 : monthCount <= 9 ? 7 : 6
  const cellPadding = monthCount <= 6 ? 1.8 : 1.2

  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const usable = pageW - MARGIN * 2

  // The numeric columns take a fixed share; PARTICULARS absorbs whatever is
  // left, so it stays wide on short reports and narrows only when it has to.
  const numericCols = monthCount + 1       // months + TOTAL
  const numColW = Math.min(30, Math.max(15, (usable * 0.62) / numericCols))
  const particularsW = usable - numColW * numericCols

  // ── Titles ──
  doc.setFont('times', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2])
  doc.text(data.churchName, pageW / 2, MARGIN + 6, { align: 'center' })

  doc.setFont('times', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(INK[0], INK[1], INK[2])
  const titleLines = doc.splitTextToSize(data.reportTitle, usable) as string[]
  doc.text(titleLines, pageW / 2, MARGIN + 13, { align: 'center' })

  const startY = MARGIN + 13 + titleLines.length * 5 + 2

  // The header labels are single words, so a column too narrow for one breaks
  // it mid-word ("SEPTEMBE" / "R"). Shrink the header type — and only the
  // header — until the longest label fits its column.
  const headerLabels = [...data.monthLabels, 'TOTAL']
  const headerAvail = numColW - cellPadding * 2 - 0.2
  let headFontSize = fontSize
  doc.setFont('times', 'bold')
  while (headFontSize > 4.5) {
    doc.setFontSize(headFontSize)
    const widest = Math.max(...headerLabels.map(l => doc.getTextWidth(l)))
    if (widest <= headerAvail) break
    headFontSize -= 0.25
  }

  // ── Body rows ──
  const body: RowInput[] = []

  // B/F sits above INCOME. The figure is the opening balance for the whole
  // period, so it is carried in the TOTAL column and the month columns stay
  // blank. (Give it a monthlyActuals entry instead if the source sheet puts it
  // in month one.)
  if (data.broughtForward !== null && data.broughtForward !== undefined) {
    body.push(lineRow(
      { particulars: 'B/F', monthlyActuals: [], total: data.broughtForward },
      monthCount,
      true,
    ))
  }

  body.push(bannerRow('INCOME', colCount, SECTION_FILL))
  data.income.categories.forEach(c => body.push(lineRow(c, monthCount, false)))
  body.push(lineRow(data.income.grandTotal, monthCount, true))

  body.push(bannerRow('EXPENDITURE', colCount, SECTION_FILL))
  data.expenditure.groups.forEach(g => {
    if (g.groupName !== null) body.push(bannerRow(g.groupName, colCount, GROUP_FILL))
    g.categories.forEach(c => body.push(lineRow(c, monthCount, false)))
    // A flat group (groupName === null) prints no sub-total — it has no
    // sub-heading to total against.
    if (g.groupName !== null) body.push(lineRow(g.groupTotal, monthCount, true))
  })
  body.push(lineRow(data.expenditure.grandTotal, monthCount, true))

  // ── Table ──
  const columnStyles: Record<number, Partial<Styles>> = {
    0: { cellWidth: particularsW, halign: 'left' },
  }
  for (let i = 1; i < colCount; i++) {
    columnStyles[i] = { cellWidth: numColW, halign: 'right' }
  }

  autoTable(doc, {
    startY,
    margin: { left: MARGIN, right: MARGIN, bottom: MARGIN + 6 },
    head: [['PARTICULARS', ...data.monthLabels, 'TOTAL']],
    body,
    theme: 'grid',
    styles: {
      font: 'times',
      fontSize,
      cellPadding,
      textColor: INK,
      lineColor: BORDER,
      lineWidth: 0.1,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      font: 'times',
      fontStyle: 'bold',
      fontSize: headFontSize,
      fillColor: NAVY,
      textColor: 255,
      halign: 'center',
      valign: 'middle',
    },
    columnStyles,
    // Page-number footer — a 12-month statement can run to two pages.
    didDrawPage: () => {
      const pageH = doc.internal.pageSize.getHeight()
      doc.setFont('times', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text(`Page ${doc.getNumberOfPages()}`, pageW - MARGIN, pageH - 6, { align: 'right' })
    },
  })

  return doc
}

// ─── Public entry point ──────────────────────────────────────────────────────

export function generateIncomeExpenditurePdf(
  data: IncomeExpenditureReportData,
  filename: string,
): void {
  const doc = buildIncomeExpenditureDoc(data)
  doc.save(filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`)
}

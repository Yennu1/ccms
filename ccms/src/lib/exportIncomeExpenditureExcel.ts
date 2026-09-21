import * as XLSX from 'xlsx'
import type { IncomeExpenditureReportData, ReportLineItem } from './exportIncomeExpenditurePdf'

// ─────────────────────────────────────────────────────────────────────────────
// Income & Expenditure Account — Excel export
//
// Same statement layout as the PDF (exportIncomeExpenditurePdf.ts):
//
//   PARTICULARS | <one column per month> | TOTAL
//   B/F (optional) · INCOME band · categories · GRAND TOTAL ·
//   EXPENDITURE band · [group name] · categories · [group TOTAL] · GRAND TOTAL
//
// The difference from the PDF: the TOTAL column and every GRAND TOTAL / group
// TOTAL cell is a LIVE `=SUM(...)` formula, not a typed number — edit a figure
// in Excel and the totals recalculate. Each formula also carries a cached
// value (`v`) so the numbers show correctly in any viewer before Excel
// recalculates. Blank cells stay genuinely empty, so SUM skips them (no zeros).
// ─────────────────────────────────────────────────────────────────────────────

const NUM_FMT = '#,##0.00'

// A1-style column letter for a zero-based column index (0 -> A, 26 -> AA…).
function colLetter(i: number): string {
  let s = ''
  let n = i
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 } while (n >= 0)
  return s
}

type Cell = XLSX.CellObject

function blank(): Cell { return { t: 'z' } as Cell } // empty cell
function text(v: string): Cell { return { t: 's', v } }
function num(v: number | null | undefined): Cell {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return blank()
  return { t: 'n', v: Math.round(Number(v) * 100) / 100, z: NUM_FMT }
}
// A formula cell carrying both the formula and a cached numeric result.
function formula(f: string, cached: number | null): Cell {
  const c: Cell = { t: 'n', f, z: NUM_FMT } as Cell
  if (cached !== null && Number.isFinite(cached)) c.v = Math.round(cached * 100) / 100
  return c
}

function sumOrNull(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v !== null && v !== undefined && Number.isFinite(Number(v)))
  if (nums.length === 0) return null
  return nums.reduce((s, v) => s + Number(v), 0)
}

export function generateIncomeExpenditureExcel(
  data: IncomeExpenditureReportData,
  filename: string,
): void {
  const monthCount = data.monthLabels.length
  const totalCol = monthCount + 1              // 0 = PARTICULARS, 1..monthCount = months, last = TOTAL
  const firstMonthColLetter = colLetter(1)
  const lastMonthColLetter = colLetter(monthCount)

  // Rows are built as arrays of CellObjects; we track the sheet row index (1-based
  // for A1 refs) so total rows can reference the exact category rows above them.
  const rows: Cell[][] = []
  const rowRefs = { income: [] as number[], expenditureByGroup: [] as number[][] }

  // ── Title rows (kept minimal; the PDF carries the full styling) ──
  rows.push([text(data.churchName)])
  rows.push([text(data.reportTitle)])
  rows.push([blank()])
  const headerRowIdx = rows.length + 1 // 1-based sheet row of the column header

  // ── Column header ──
  rows.push([text('PARTICULARS'), ...data.monthLabels.map(text), text('TOTAL')])

  // Helper: a category row. TOTAL cell is =SUM across the month cells of THIS row.
  function categoryRow(item: ReportLineItem): void {
    const sheetRow = rows.length + 1 // 1-based, becomes valid after push
    const cells: Cell[] = [text(item.particulars)]
    for (let m = 0; m < monthCount; m++) cells.push(num(item.monthlyActuals[m]))
    const cached = sumOrNull(item.monthlyActuals.slice(0, monthCount))
    cells.push(formula(`SUM(${firstMonthColLetter}${sheetRow}:${lastMonthColLetter}${sheetRow})`, cached))
    rows.push(cells)
  }

  // Helper: a band row (INCOME / EXPENDITURE / group name) spanning all columns.
  function bandRow(label: string): number {
    const sheetRow = rows.length + 1
    const cells: Cell[] = [text(label)]
    for (let i = 1; i <= totalCol; i++) cells.push(blank())
    rows.push(cells)
    return sheetRow
  }

  // Helper: a total row that sums DOWN a set of category sheet-rows, per column.
  function totalRow(label: string, catRows: number[], perColumnCached: (number | null)[], totalCached: number | null): void {
    const sheetRow = rows.length + 1
    const cells: Cell[] = [text(label)]
    for (let m = 1; m <= monthCount; m++) {
      const cl = colLetter(m)
      if (catRows.length === 0) { cells.push(blank()); continue }
      const refs = catRows.map(r => `${cl}${r}`).join(',')
      cells.push(formula(`SUM(${refs})`, perColumnCached[m - 1] ?? null))
    }
    // TOTAL column of a total row sums that row's own month cells.
    cells.push(formula(`SUM(${firstMonthColLetter}${sheetRow}:${lastMonthColLetter}${sheetRow})`, totalCached))
    rows.push(cells)
  }

  // ── B/F (optional) ──
  if (data.broughtForward !== null && data.broughtForward !== undefined) {
    const cells: Cell[] = [text('B/F')]
    for (let m = 0; m < monthCount; m++) cells.push(blank())
    cells.push(num(data.broughtForward))
    rows.push(cells)
  }

  // ── INCOME ──
  bandRow('INCOME')
  data.income.categories.forEach(c => { categoryRow(c); rowRefs.income.push(rows.length) })
  {
    const perCol = data.monthLabels.map((_, m) => sumOrNull(data.income.categories.map(c => c.monthlyActuals[m])))
    const grand = sumOrNull(perCol)
    totalRow(data.income.grandTotal.particulars || 'GRAND TOTAL', rowRefs.income, perCol, grand)
  }

  // ── EXPENDITURE ──
  bandRow('EXPENDITURE')
  const allExpRows: number[] = []
  data.expenditure.groups.forEach(g => {
    if (g.groupName !== null) bandRow(g.groupName)
    const groupRows: number[] = []
    g.categories.forEach(c => { categoryRow(c); groupRows.push(rows.length); allExpRows.push(rows.length) })
    rowRefs.expenditureByGroup.push(groupRows)
    if (g.groupName !== null) {
      const perCol = data.monthLabels.map((_, m) => sumOrNull(g.categories.map(c => c.monthlyActuals[m])))
      totalRow(g.groupTotal.particulars || 'TOTAL', groupRows, perCol, sumOrNull(perCol))
    }
  })
  {
    const perCol = data.monthLabels.map((_, m) =>
      sumOrNull(data.expenditure.groups.flatMap(g => g.categories.map(c => c.monthlyActuals[m]))))
    totalRow(data.expenditure.grandTotal.particulars || 'GRAND TOTAL', allExpRows, perCol, sumOrNull(perCol))
  }

  // ── Build the sheet ──
  const ws: XLSX.WorkSheet = {}
  const range = { s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: totalCol } }
  rows.forEach((cells, r) => {
    cells.forEach((cell, c) => {
      if (cell.t === 'z') return // leave empty cells truly empty
      ws[XLSX.utils.encode_cell({ r, c })] = cell
    })
  })
  ws['!ref'] = XLSX.utils.encode_range(range)

  // Column widths: PARTICULARS wide, numeric columns even.
  ws['!cols'] = [{ wch: 26 }, ...data.monthLabels.map(() => ({ wch: 14 })), { wch: 16 }]

  // Merge the title rows and the band rows across the full width.
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCol } },
  ]
  // Band rows (INCOME / EXPENDITURE / group names) — detect by a label in col 0
  // with blanks after, from the header row down.
  for (let r = headerRowIdx; r < rows.length; r++) {
    const first = rows[r][0]
    const second = rows[r][1]
    const isBand = first && first.t === 's' && (!second || second.t === 'z') &&
      ['INCOME', 'EXPENDITURE'].includes(String(first.v)) ||
      (first && first.t === 's' && (!second || second.t === 'z'))
    if (isBand) merges.push({ s: { r, c: 0 }, e: { r, c: totalCol } })
  }
  ws['!merges'] = merges

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'I&E Account')
  const name = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(wb, name)
}

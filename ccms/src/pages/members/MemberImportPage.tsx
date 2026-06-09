import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportStep = 'upload' | 'map' | 'preview' | 'importing' | 'done'
type PreviewFilter = 'all' | 'errors' | 'warnings'
type RowStatus = 'ok' | 'warning' | 'error'

interface Branch { id: string; name: string }

interface MappedData {
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  gender: string | null
  marital_status: string | null
  address: string | null
  city: string | null
  region: string | null
  occupation: string | null
  employer: string | null
  membership_date: string | null
  baptism_date: string | null
  notes: string | null
}

interface ValidatedRow {
  rowIndex: number
  original: Record<string, string>
  mapped: MappedData
  status: RowStatus
  errors: string[]
  warnings: string[]
}

interface ImportResult {
  success: number
  skipped: Array<{ rowIndex: number; name: string; reason: string }>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CCMS_FIELDS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: '__skip',          label: '(Skip this column)' },
  { key: 'first_name',      label: 'First Name',       required: true },
  { key: 'last_name',       label: 'Last Name',        required: true },
  { key: 'email',           label: 'Email' },
  { key: 'phone',           label: 'Phone' },
  { key: 'date_of_birth',   label: 'Date of Birth' },
  { key: 'gender',          label: 'Gender' },
  { key: 'marital_status',  label: 'Marital Status' },
  { key: 'address',         label: 'Address' },
  { key: 'city',            label: 'City' },
  { key: 'region',          label: 'Region' },
  { key: 'occupation',      label: 'Occupation' },
  { key: 'employer',        label: 'Employer' },
  { key: 'membership_date', label: 'Membership Date' },
  { key: 'baptism_date',    label: 'Baptism Date' },
  { key: 'notes',           label: 'Notes' },
]

const STEP_LABELS: Array<{ key: ImportStep; label: string }> = [
  { key: 'upload',    label: 'Upload' },
  { key: 'map',       label: 'Map Columns' },
  { key: 'preview',   label: 'Preview' },
  { key: 'importing', label: 'Import' },
]

const BATCH_SIZE = 50

// ─── Helpers ──────────────────────────────────────────────────────────────────

function autoMatch(header: string): string {
  const h = header.toLowerCase().trim().replace(/[\s_\-]+/g, ' ')
  if (h === 'first name' || h === 'firstname' || h === 'given name') return 'first_name'
  if (h === 'last name' || h === 'lastname' || h === 'surname' || h === 'family name') return 'last_name'
  if (h.includes('email') || h === 'e-mail') return 'email'
  if (h === 'phone' || h === 'phone number' || h === 'tel' || h === 'mobile' || h === 'contact' || h === 'phone no') return 'phone'
  if (h === 'dob' || h === 'date of birth' || h === 'birthdate' || h === 'birthday' || h.includes('birth')) return 'date_of_birth'
  if (h === 'sex' || h === 'gender') return 'gender'
  if (h.includes('marital')) return 'marital_status'
  if (h === 'address' || h.includes('street') || h === 'home address') return 'address'
  if (h === 'city' || h === 'town') return 'city'
  if (h === 'region' || h === 'state' || h === 'province' || h === 'district') return 'region'
  if (h.includes('occup') || h === 'profession' || h === 'job title' || h === 'job') return 'occupation'
  if (h.includes('employ') || h === 'company' || h === 'workplace' || h === 'organization') return 'employer'
  if ((h.includes('member') && h.includes('date')) || h === 'join date' || h === 'joined' || h === 'date joined') return 'membership_date'
  if (h.includes('bapti')) return 'baptism_date'
  if (h === 'notes' || h === 'note' || h === 'comments' || h === 'remarks') return 'notes'
  return '__skip'
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

function parseDate(val: string): { date: string | null; warning: boolean } {
  if (!val || !val.trim()) return { date: null, warning: false }
  const v = val.trim()

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(v + 'T00:00:00')
    return isNaN(d.getTime()) ? { date: null, warning: true } : { date: v, warning: false }
  }

  // DD/MM/YYYY or DD-MM-YYYY (Ghana default)
  const dmy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    const iso = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    const d = new Date(iso + 'T00:00:00')
    if (!isNaN(d.getTime())) return { date: iso, warning: false }
  }

  // DD-Mon-YYYY or DD Mon YYYY (e.g. "15 Jan 1990", "15-Jan-1990")
  const dMonY = v.match(/^(\d{1,2})[\s\-]([a-zA-Z]{3,9})[\s\-](\d{4})$/)
  if (dMonY) {
    const m = MONTHS[dMonY[2].toLowerCase().slice(0, 3)]
    if (m) {
      const iso = `${dMonY[3]}-${m}-${dMonY[1].padStart(2, '0')}`
      const d = new Date(iso + 'T00:00:00')
      if (!isNaN(d.getTime())) return { date: iso, warning: false }
    }
  }

  // Fallback JS parse — flag as warning (ambiguous)
  const d = new Date(v)
  if (!isNaN(d.getTime())) return { date: d.toISOString().split('T')[0], warning: true }

  return { date: null, warning: true }
}

function normalizeGender(val: string): string | null {
  const v = (val ?? '').trim().toLowerCase()
  if (!v) return null
  if (v === 'm' || v === 'male') return 'male'
  if (v === 'f' || v === 'female') return 'female'
  return null
}

function normalizeMarital(val: string): string | null {
  const v = (val ?? '').trim().toLowerCase()
  if (!v) return null
  if (v === 'single')   return 'single'
  if (v === 'married')  return 'married'
  if (v === 'divorced') return 'divorced'
  if (v === 'widowed')  return 'widowed'
  return null
}

function normalizePhone(val: string): string | null {
  if (!val) return null
  const cleaned = val.replace(/[\s\-\(\)\+\.]/g, '')
  return cleaned || null
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function UploadCloudIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect width="44" height="44" rx="12" fill="#E8ECF9" />
      <path d="M22 28v-9M19 22l3-3 3 3" stroke="#4F6BED" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 30h12M30 25a4.5 4.5 0 0 0-1.7-8.7A6.5 6.5 0 1 0 16 20.4" stroke="#4F6BED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
      <rect width="34" height="34" rx="9" fill="#E8ECF9" />
      <path d="M12 9h7l6 6v12H12V9z" stroke="#4F6BED" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <path d="M19 9v6h6" stroke="#4F6BED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 19h6M15 22h6" stroke="#4F6BED" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function CheckCircleBigIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <rect width="52" height="52" rx="14" fill="#DCFCE7" />
      <path d="M16 26l7 7 13-13" stroke="#15803D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: ImportStep }) {
  const order = STEP_LABELS.map(s => s.key)
  const currentIdx = order.indexOf(currentStep)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 32 }}>
      {STEP_LABELS.map((step, idx) => {
        const done = idx < currentIdx
        const active = idx === currentIdx
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: idx < STEP_LABELS.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: done || active ? '#4F6BED' : 'var(--dm-bg-muted)',
                color: done || active ? '#fff' : 'var(--dm-text-muted)',
                border: done || active ? 'none' : '0.5px solid var(--dm-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 12,
                flexShrink: 0,
              }}>
                {done
                  ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  : idx + 1
                }
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fontWeight: active ? 600 : 400, color: active || done ? '#4F6BED' : 'var(--dm-text-muted)', whiteSpace: 'nowrap' }}>
                {step.label}
              </div>
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: done ? '#4F6BED' : 'var(--dm-border)', margin: '0 8px', marginBottom: 22 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function MemberImportPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // ── Global state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<ImportStep>('upload')
  const [branches, setBranches] = useState<Branch[]>([])

  // ── Step 1: Upload ────────────────────────────────────────────────────────
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [rawHeaders, setRawHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Step 2: Map ───────────────────────────────────────────────────────────
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [selectedBranchId, setSelectedBranchId] = useState('')

  // ── Step 3: Preview ───────────────────────────────────────────────────────
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([])
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all')

  // ── Step 4: Importing / Done ──────────────────────────────────────────────
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  useEffect(() => {
    if (!user?.org_id) return
    supabase.from('branches').select('id, name').eq('org_id', user.org_id).order('name')
      .then(({ data }) => { if (data) setBranches(data as Branch[]) })
  }, [user?.org_id])

  // ── File parsing ──────────────────────────────────────────────────────────

  const parseFile = useCallback(async (file: File) => {
    try {
      const XLSX = await import('xlsx')
      const ab = await file.arrayBuffer()
      const wb = XLSX.read(ab, { type: 'array', raw: false, cellDates: false })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })

      if (jsonRows.length === 0) {
        toast.error('The file appears to be empty or has no data rows.')
        return
      }

      const headers = Object.keys(jsonRows[0])
      if (headers.length === 0) {
        toast.error('Could not detect column headers.')
        return
      }

      const stringRows: Record<string, string>[] = jsonRows.map(row =>
        Object.fromEntries(headers.map(h => [h, String(row[h] ?? '').trim()]))
      )

      const initialMap: Record<string, string> = {}
      headers.forEach(h => { initialMap[h] = autoMatch(h) })

      setRawHeaders(headers)
      setRawRows(stringRows)
      setFileName(file.name)
      setColumnMap(initialMap)
      setStep('map')
    } catch {
      toast.error('Failed to parse file. Please check the format and try again.')
    }
  }, [])

  const handleFileSelect = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      toast.error('Please upload a .csv, .xlsx, or .xls file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10 MB.')
      return
    }
    parseFile(file)
  }, [parseFile])

  // ── Validation ────────────────────────────────────────────────────────────

  const runValidation = useCallback(() => {
    const getVal = (row: Record<string, string>, fieldKey: string): string => {
      const header = Object.entries(columnMap).find(([, v]) => v === fieldKey)?.[0]
      return header ? (row[header] ?? '') : ''
    }

    const rows: ValidatedRow[] = rawRows.map((raw, idx) => {
      const errors: string[] = []
      const warnings: string[] = []

      const firstName = getVal(raw, 'first_name').trim()
      const lastName  = getVal(raw, 'last_name').trim()
      if (!firstName) errors.push('First Name is required')
      if (!lastName)  errors.push('Last Name is required')

      const email = getVal(raw, 'email').trim()
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) warnings.push('Invalid email format')

      const dobRaw = getVal(raw, 'date_of_birth')
      const { date: dob, warning: dobWarn } = parseDate(dobRaw)
      if (dobRaw && dobWarn) warnings.push('Date of birth could not be parsed reliably')

      const mdRaw = getVal(raw, 'membership_date')
      const { date: membershipDate, warning: mdWarn } = parseDate(mdRaw)
      if (mdRaw && mdWarn) warnings.push('Membership date could not be parsed reliably')

      const bdRaw = getVal(raw, 'baptism_date')
      const { date: baptismDate, warning: bdWarn } = parseDate(bdRaw)
      if (bdRaw && bdWarn) warnings.push('Baptism date could not be parsed reliably')

      const genderRaw = getVal(raw, 'gender')
      const gender = normalizeGender(genderRaw)
      if (genderRaw && !gender) warnings.push('Gender not recognised — use Male/Female/M/F')

      const status: RowStatus = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok'

      return {
        rowIndex: idx,
        original: raw,
        mapped: {
          first_name:      firstName,
          last_name:       lastName,
          email:           email || null,
          phone:           normalizePhone(getVal(raw, 'phone')),
          date_of_birth:   dob,
          gender,
          marital_status:  normalizeMarital(getVal(raw, 'marital_status')),
          address:         getVal(raw, 'address').trim() || null,
          city:            getVal(raw, 'city').trim() || null,
          region:          getVal(raw, 'region').trim() || null,
          occupation:      getVal(raw, 'occupation').trim() || null,
          employer:        getVal(raw, 'employer').trim() || null,
          membership_date: membershipDate,
          baptism_date:    baptismDate,
          notes:           getVal(raw, 'notes').trim() || null,
        },
        status,
        errors,
        warnings,
      }
    })

    setValidatedRows(rows)
    setPreviewFilter('all')
    setStep('preview')
  }, [rawRows, columnMap])

  // ── Import execution ──────────────────────────────────────────────────────

  const runImport = useCallback(async () => {
    if (!user) return
    setStep('importing')

    const skipped: ImportResult['skipped'] = []

    // Rows with errors are immediately skipped
    for (const row of validatedRows.filter(r => r.status === 'error')) {
      skipped.push({
        rowIndex: row.rowIndex + 2,
        name: [row.mapped.first_name, row.mapped.last_name].filter(Boolean).join(' ') || `Row ${row.rowIndex + 2}`,
        reason: row.errors.join('; '),
      })
    }

    const candidates = validatedRows.filter(r => r.status !== 'error')

    // Pre-fetch existing members for duplicate detection
    const { data: existing } = await supabase
      .from('members')
      .select('first_name, last_name, email, phone')
      .eq('org_id', user.org_id)

    const nameSet  = new Set((existing ?? []).map(m => `${(m.first_name ?? '').toLowerCase()}|${(m.last_name ?? '').toLowerCase()}`))
    const emailSet = new Set((existing ?? []).filter(m => m.email).map(m => (m.email as string).toLowerCase()))
    const phoneSet = new Set((existing ?? []).filter(m => m.phone).map(m => m.phone as string))

    const toImport: ValidatedRow[] = []
    for (const row of candidates) {
      const nameKey  = `${row.mapped.first_name.toLowerCase()}|${row.mapped.last_name.toLowerCase()}`
      const emailDup = row.mapped.email  ? emailSet.has(row.mapped.email.toLowerCase()) : false
      const phoneDup = row.mapped.phone  ? phoneSet.has(row.mapped.phone) : false
      const nameDup  = nameSet.has(nameKey)
      const isDup    = nameDup && (emailDup || phoneDup || (!row.mapped.email && !row.mapped.phone))

      if (isDup) {
        skipped.push({
          rowIndex: row.rowIndex + 2,
          name: `${row.mapped.first_name} ${row.mapped.last_name}`,
          reason: 'Duplicate — member already exists',
        })
      } else {
        toImport.push(row)
        // Add to sets to catch intra-import duplicates
        nameSet.add(nameKey)
        if (row.mapped.email) emailSet.add(row.mapped.email.toLowerCase())
        if (row.mapped.phone) phoneSet.add(row.mapped.phone)
      }
    }

    setImportProgress({ current: 0, total: toImport.length })

    if (toImport.length === 0) {
      setImportResult({ success: 0, skipped })
      setStep('done')
      return
    }

    // Determine starting member number
    const { data: recentMembers } = await supabase
      .from('members')
      .select('member_number')
      .eq('org_id', user.org_id)
      .not('member_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)

    let startNum = 1
    if (recentMembers && recentMembers.length > 0) {
      const nums = recentMembers
        .map(m => { const match = (m.member_number ?? '').match(/(\d+)$/); return match ? parseInt(match[1]) : 0 })
        .filter(n => n > 0)
      if (nums.length > 0) startNum = Math.max(...nums) + 1
    }

    // Batch insert
    let successCount = 0
    for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
      const batch = toImport.slice(i, i + BATCH_SIZE)
      const insertRows = batch.map((row, bIdx) => ({
        org_id:            user.org_id,
        branch_id:         selectedBranchId,
        first_name:        row.mapped.first_name,
        last_name:         row.mapped.last_name,
        email:             row.mapped.email,
        phone:             row.mapped.phone,
        date_of_birth:     row.mapped.date_of_birth,
        gender:            row.mapped.gender,
        marital_status:    row.mapped.marital_status,
        address:           row.mapped.address,
        city:              row.mapped.city,
        region:            row.mapped.region,
        occupation:        row.mapped.occupation,
        employer:          row.mapped.employer,
        membership_date:   row.mapped.membership_date,
        baptism_date:      row.mapped.baptism_date,
        notes:             row.mapped.notes,
        membership_status: 'active',
        member_number:     `GH-${String(startNum + i + bIdx).padStart(5, '0')}`,
        created_by:        user.id,
      }))

      const { data: inserted, error } = await supabase.from('members').insert(insertRows).select('id')

      if (error) {
        batch.forEach(row => {
          skipped.push({
            rowIndex: row.rowIndex + 2,
            name: `${row.mapped.first_name} ${row.mapped.last_name}`,
            reason: error.message,
          })
        })
      } else {
        successCount += inserted?.length ?? batch.length
      }

      setImportProgress({ current: Math.min(i + BATCH_SIZE, toImport.length), total: toImport.length })
    }

    setImportResult({ success: successCount, skipped })
    setStep('done')
  }, [user, validatedRows, selectedBranchId])

  // ── Derived preview state ──────────────────────────────────────────────────

  const errorCount   = useMemo(() => validatedRows.filter(r => r.status === 'error').length,   [validatedRows])
  const warningCount = useMemo(() => validatedRows.filter(r => r.status === 'warning').length, [validatedRows])
  const okCount      = useMemo(() => validatedRows.filter(r => r.status === 'ok').length,      [validatedRows])
  const readyCount   = okCount + warningCount

  const filteredRows = useMemo(() => {
    if (previewFilter === 'errors')   return validatedRows.filter(r => r.status === 'error')
    if (previewFilter === 'warnings') return validatedRows.filter(r => r.status === 'warning')
    return validatedRows
  }, [validatedRows, previewFilter])

  // ── Shared styles ─────────────────────────────────────────────────────────

  const inputBase: React.CSSProperties = {
    height: 38, borderRadius: 8, border: '0.5px solid var(--dm-border)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13, color: 'var(--dm-text-ink)', background: 'var(--dm-bg-card)',
    outline: 'none', padding: '0 10px', transition: 'border-color 0.15s',
  }

  const btnSecondary: React.CSSProperties = {
    height: 38, padding: '0 18px', borderRadius: 8,
    border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)',
    cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)',
  }

  const btnPrimary: React.CSSProperties = {
    height: 38, padding: '0 20px', borderRadius: 8,
    border: 'none', background: '#4F6BED',
    cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontWeight: 600, fontSize: 13, color: '#fff',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  }

  const thStyle: React.CSSProperties = {
    padding: '9px 12px',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left',
    borderBottom: '0.5px solid var(--dm-border-soft)',
    background: 'var(--dm-bg-subtle)', whiteSpace: 'nowrap',
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes imp-spin { to { transform: rotate(360deg); } }
        .imp-spinner { animation: imp-spin 0.75s linear infinite; }
        .drop-zone { transition: border-color 0.15s, background 0.15s; }
        .drop-zone:hover, .drop-zone.drag-over { border-color: #4F6BED !important; background: #EEF1FC !important; }
        .imp-select:focus { border-color: #4F6BED !important; outline: none; }
        .imp-input:focus  { border-color: #4F6BED !important; }
        .btn-sec:hover  { background: var(--dm-bg-muted) !important; }
        .btn-pri:hover  { background: #3D59DB !important; }
        .imp-row:hover  { background: var(--dm-bg-muted) !important; }
        .map-row:nth-child(even) { background: var(--dm-bg-subtle); }
      `}</style>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <button
            onClick={() => navigate('/members')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: 'var(--dm-text-secondary)', display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <BackArrowIcon />
          </button>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)' }}>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/members')}
              onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--dm-text-body)')}
              onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--dm-text-muted)')}>
              Members
            </span>
            {' / Import'}
          </div>
        </div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 20, color: 'var(--dm-text-ink)', letterSpacing: '-0.02em', margin: '0 0 0 34px' }}>
          Import Members
        </h1>
      </div>

      {/* ── Step indicator ──────────────────────────────────────────────── */}
      {step !== 'done' && <StepIndicator currentStep={step} />}

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 820 }}>

        {/* ── STEP 1: Upload ──────────────────────────────────────────── */}
        {step === 'upload' && (
          <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: 28 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }}
            />

            {/* Drop zone */}
            <div
              className={`drop-zone${dragging ? ' drag-over' : ''}`}
              style={{
                border: '2px dashed var(--dm-border-soft)', borderRadius: 12,
                padding: '52px 24px', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'center',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f) }}
            >
              <UploadCloudIcon />
              <div>
                <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--dm-text-ink)', marginBottom: 6 }}>
                  Drop a CSV or Excel file here, or click to browse
                </div>
                <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>
                  Accepts .csv, .xlsx, .xls · Max 10 MB
                </div>
              </div>
            </div>

            {/* Tips */}
            <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--dm-bg-subtle)', borderRadius: 8, border: '0.5px solid var(--dm-border-soft)' }}>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Tips</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12.5, color: 'var(--dm-text-secondary)', lineHeight: 1.75 }}>
                <li>First row must contain column headers (e.g. "First Name", "Email")</li>
                <li>You'll map each column to a CCMS field in the next step</li>
                <li>Dates: DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD all accepted</li>
                <li>Gender: Male / Female / M / F — Marital Status: Single / Married / etc.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── STEP 2: Map Columns ──────────────────────────────────────── */}
        {step === 'map' && (
          <div>
            {/* File info */}
            <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: 20, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <FileIcon />
                <div>
                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--dm-text-ink)' }}>{fileName}</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)', marginTop: 2 }}>
                    {rawRows.length} data rows · {rawHeaders.length} columns detected
                  </div>
                </div>
                <button
                  onClick={() => setStep('upload')}
                  style={{ marginLeft: 'auto', ...btnSecondary, height: 32, padding: '0 12px', fontSize: 12 }}
                  className="btn-sec"
                >
                  Change file
                </button>
              </div>

              {/* Column map table */}
              <div style={{ border: '0.5px solid var(--dm-border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, padding: '8px 14px', background: 'var(--dm-bg-subtle)', borderBottom: '0.5px solid var(--dm-border-soft)' }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>File column</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Maps to CCMS field</div>
                </div>
                {rawHeaders.map((header, idx) => (
                  <div
                    key={header}
                    className="map-row"
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '8px 14px', alignItems: 'center', borderBottom: idx < rawHeaders.length - 1 ? '0.5px solid var(--dm-border-soft)' : 'none' }}
                  >
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: 'var(--dm-text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {header}
                    </div>
                    <select
                      className="imp-select"
                      value={columnMap[header] ?? '__skip'}
                      onChange={e => setColumnMap(prev => ({ ...prev, [header]: e.target.value }))}
                      style={{ ...inputBase, height: 34, fontSize: 12.5, padding: '0 8px', width: '100%' }}
                    >
                      {CCMS_FIELDS.map(f => (
                        <option key={f.key} value={f.key}>
                          {f.label}{f.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Branch selector */}
            <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <label style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)', display: 'block', marginBottom: 8 }}>
                Assign all imported members to{' '}
                <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                className="imp-select"
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
                style={{ ...inputBase, width: '100%' }}
              >
                <option value="">Select a branch…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {/* Nav */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-sec" onClick={() => setStep('upload')} style={btnSecondary}>Back</button>
              <button
                className="btn-pri"
                style={btnPrimary}
                onClick={() => {
                  if (!selectedBranchId) { toast.error('Please select a branch.'); return }
                  const hasFN = Object.values(columnMap).includes('first_name')
                  const hasLN = Object.values(columnMap).includes('last_name')
                  if (!hasFN || !hasLN) { toast.error('Map both First Name and Last Name columns before continuing.'); return }
                  runValidation()
                }}
              >
                Continue to Preview →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Preview & Validate ───────────────────────────────── */}
        {step === 'preview' && (
          <div>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              <div style={{ padding: '14px 16px', background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 10 }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 24, color: '#15803D', lineHeight: 1 }}>{readyCount}</div>
                <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#15803D', marginTop: 4 }}>rows ready to import</div>
              </div>
              <div style={{ padding: '14px 16px', background: warningCount > 0 ? '#FFFBEB' : 'var(--dm-bg-card)', border: `0.5px solid ${warningCount > 0 ? '#FDE68A' : 'var(--dm-border)'}`, borderRadius: 10 }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 24, color: warningCount > 0 ? '#B45309' : 'var(--dm-text-muted)', lineHeight: 1 }}>{warningCount}</div>
                <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: warningCount > 0 ? '#B45309' : 'var(--dm-text-muted)', marginTop: 4 }}>rows with warnings</div>
              </div>
              <div style={{ padding: '14px 16px', background: errorCount > 0 ? '#FEF2F2' : 'var(--dm-bg-card)', border: `0.5px solid ${errorCount > 0 ? '#FECACA' : 'var(--dm-border)'}`, borderRadius: 10 }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 24, color: errorCount > 0 ? '#DC2626' : 'var(--dm-text-muted)', lineHeight: 1 }}>{errorCount}</div>
                <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: errorCount > 0 ? '#DC2626' : 'var(--dm-text-muted)', marginTop: 4 }}>rows with errors — will be skipped</div>
              </div>
            </div>

            {/* Filter toggle */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {(['all', 'errors', 'warnings'] as PreviewFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setPreviewFilter(f)}
                  style={{
                    height: 30, padding: '0 12px', borderRadius: 6, cursor: 'pointer',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12,
                    border: previewFilter === f ? 'none' : '0.5px solid var(--dm-border)',
                    background: previewFilter === f ? '#4F6BED' : 'var(--dm-bg-card)',
                    color: previewFilter === f ? '#fff' : 'var(--dm-text-secondary)',
                  }}
                >
                  {f === 'all' ? `All (${validatedRows.length})` : f === 'errors' ? `Errors (${errorCount})` : `Warnings (${warningCount})`}
                </button>
              ))}
            </div>

            {/* Preview table */}
            <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 40 }}>#</th>
                      <th style={thStyle}>First Name</th>
                      <th style={thStyle}>Last Name</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Phone</th>
                      <th style={thStyle}>Gender</th>
                      <th style={{ ...thStyle, width: 90 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>
                          No rows match this filter.
                        </td>
                      </tr>
                    ) : filteredRows.slice(0, 200).map(row => (
                      <tr
                        key={row.rowIndex}
                        className="imp-row"
                        title={[...row.errors, ...row.warnings].join(' · ') || undefined}
                        style={{
                          borderBottom: '0.5px solid var(--dm-border-soft)',
                          background: row.status === 'error'   ? 'rgba(239,68,68,0.035)'
                                    : row.status === 'warning' ? 'rgba(245,158,11,0.035)'
                                    : 'var(--dm-bg-card)',
                          borderLeft: row.status === 'error'   ? '3px solid #EF4444'
                                    : row.status === 'warning' ? '3px solid #F59E0B'
                                    : '3px solid transparent',
                          cursor: [...row.errors, ...row.warnings].length > 0 ? 'help' : 'default',
                        }}
                      >
                        <td style={{ padding: '8px 12px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-muted)' }}>
                          {row.rowIndex + 2}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: row.mapped.first_name ? 'var(--dm-text-ink)' : '#EF4444', fontStyle: row.mapped.first_name ? 'normal' : 'italic' }}>
                          {row.mapped.first_name || 'Missing'}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: row.mapped.last_name ? 'var(--dm-text-ink)' : '#EF4444', fontStyle: row.mapped.last_name ? 'normal' : 'italic' }}>
                          {row.mapped.last_name || 'Missing'}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.mapped.email ?? '—'}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--dm-text-secondary)' }}>
                          {row.mapped.phone ?? '—'}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-secondary)' }}>
                          {row.mapped.gender ?? '—'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {row.status === 'error' ? (
                            <span style={{ display: 'inline-flex', padding: '2px 7px', borderRadius: 999, background: '#FEE2E2', color: '#DC2626', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fontWeight: 600 }}>Error</span>
                          ) : row.status === 'warning' ? (
                            <span style={{ display: 'inline-flex', padding: '2px 7px', borderRadius: 999, background: '#FEF3C7', color: '#B45309', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fontWeight: 600 }}>Warning</span>
                          ) : (
                            <span style={{ display: 'inline-flex', padding: '2px 7px', borderRadius: 999, background: '#DCFCE7', color: '#15803D', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11, fontWeight: 600 }}>Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredRows.length > 200 && (
                <div style={{ padding: '10px 16px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)', borderTop: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-subtle)' }}>
                  Showing first 200 of {filteredRows.length} rows
                </div>
              )}
            </div>

            {/* Nav */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn-sec" onClick={() => setStep('map')} style={btnSecondary}>Back</button>
              {readyCount > 0 ? (
                <button className="btn-pri" onClick={runImport} style={btnPrimary}>
                  {errorCount > 0 ? `Skip ${errorCount} error${errorCount !== 1 ? 's' : ''} and import ${readyCount} member${readyCount !== 1 ? 's' : ''}` : `Import ${readyCount} member${readyCount !== 1 ? 's' : ''}`}
                </button>
              ) : (
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>
                  No valid rows to import — fix errors or go back to remap columns.
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 4: Importing ────────────────────────────────────────── */}
        {step === 'importing' && (
          <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: '56px 32px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <svg className="imp-spinner" width="44" height="44" viewBox="0 0 44 44" fill="none">
                <circle cx="22" cy="22" r="18" stroke="rgba(79,107,237,0.18)" strokeWidth="3.5" />
                <path d="M22 4a18 18 0 0 1 18 18" stroke="#4F6BED" strokeWidth="3.5" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 17, color: 'var(--dm-text-ink)', marginBottom: 8 }}>
              Importing members…
            </div>
            <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)', marginBottom: 24 }}>
              {importProgress.current} of {importProgress.total} processed
            </div>
            <div style={{ maxWidth: 320, margin: '0 auto', background: 'var(--dm-bg-muted)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
              <div style={{
                height: 6, borderRadius: 999, background: '#4F6BED',
                width: importProgress.total > 0 ? `${Math.round((importProgress.current / importProgress.total) * 100)}%` : '0%',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}

        {/* ── STEP 5: Done ─────────────────────────────────────────────── */}
        {step === 'done' && importResult && (
          <div>
            {/* Success card */}
            <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: '36px 32px', textAlign: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <CheckCircleBigIcon />
              </div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 22, color: 'var(--dm-text-ink)', marginBottom: 8 }}>
                Import complete
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 14, color: 'var(--dm-text-secondary)', marginBottom: 28 }}>
                Successfully imported{' '}
                <strong style={{ color: '#15803D' }}>{importResult.success} member{importResult.success !== 1 ? 's' : ''}</strong>
                {importResult.skipped.length > 0 && (
                  <> · <strong style={{ color: '#DC2626' }}>{importResult.skipped.length} row{importResult.skipped.length !== 1 ? 's' : ''} skipped</strong></>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                <button
                  className="btn-pri"
                  onClick={() => navigate('/members')}
                  style={btnPrimary}
                >
                  View Members
                </button>
                <button
                  className="btn-sec"
                  onClick={() => {
                    setStep('upload')
                    setFileName('')
                    setRawHeaders([])
                    setRawRows([])
                    setColumnMap({})
                    setSelectedBranchId('')
                    setValidatedRows([])
                    setImportResult(null)
                  }}
                  style={btnSecondary}
                >
                  Import another file
                </button>
              </div>
            </div>

            {/* Skipped rows */}
            {importResult.skipped.length > 0 && (
              <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', borderBottom: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-subtle)' }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--dm-text-ink)' }}>
                    Skipped rows ({importResult.skipped.length})
                  </div>
                </div>
                {importResult.skipped.map((s, i) => (
                  <div
                    key={i}
                    style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 18px', borderBottom: i < importResult.skipped.length - 1 ? '0.5px solid var(--dm-border-soft)' : 'none' }}
                  >
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--dm-text-muted)', minWidth: 48, flexShrink: 0 }}>
                      Row {s.rowIndex}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-ink)', minWidth: 160, flexShrink: 0 }}>
                      {s.name}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#DC2626' }}>
                      {s.reason}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

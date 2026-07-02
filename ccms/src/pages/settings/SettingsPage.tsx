import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useSettings } from '../../contexts/SettingsContext'
import { useSidebar } from '../../contexts/SidebarContext'
import { ROLE_LABELS } from '../../lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string
  org_id: string
  name: string
  type: 'income' | 'expense'
  is_default: boolean
  created_at: string
  usage_count: number
}

interface UserRoleEntry {
  id: string
  user_id: string
  role: 'super_admin' | 'admin' | 'finance_officer' | 'group_leader'
  branch_id: string | null
  is_active: boolean
  profile: { full_name: string; email: string } | null
  branch: { name: string } | null
}

interface BranchOption {
  id: string
  name: string
}

type SettingsTab = 'profile' | 'general' | 'branches' | 'access_control' | 'billing' | 'categories' | 'notifications'

// ─── Access control helpers ───────────────────────────────────────────────────

const ROLE_OPTIONS: { value: UserRoleEntry['role']; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Branch Admin' },
  { value: 'finance_officer', label: 'Finance Officer' },
  { value: 'group_leader', label: 'Group Leader' },
]

const ROLE_BADGE_COLOR: Record<UserRoleEntry['role'], string> = {
  super_admin: '#1B2352',
  admin: '#4F6BED',
  finance_officer: '#7B93F5',
  group_leader: '#C8964A',
}

const ROLE_LEGEND: { role: UserRoleEntry['role']; name: string; desc: string }[] = [
  { role: 'super_admin', name: 'Super Admin', desc: 'Full access, all branches' },
  { role: 'admin', name: 'Branch Admin', desc: 'Full access, own branch' },
  { role: 'finance_officer', name: 'Finance Officer', desc: 'Financial data, own branch' },
  { role: 'group_leader', name: 'Group Leader', desc: 'Own group only' },
]

const AVATAR_PALETTE = [
  { bg: '#E8ECF9', color: '#4F6BED' },
  { bg: '#DCFCE7', color: '#15803D' },
  { bg: '#FEF3C7', color: '#B45309' },
  { bg: '#FCE7F3', color: '#BE185D' },
  { bg: '#EEF2FF', color: '#4338CA' },
  { bg: '#FFF7ED', color: '#C2410C' },
  { bg: '#F0FDFA', color: '#0F766E' },
  { bg: '#F5F3FF', color: '#7C3AED' },
]

function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (name.trim().slice(0, 2) || '??').toUpperCase()
}

// Supabase can return embedded to-one relations as an object or a single-item array.
function normalizeRel<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null
  return rel ?? null
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
}

function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M3 4h10M6 4V2.5h4V4M5 4l.7 9.5h4.6L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function TagIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M17.4 10.6l-7-7A1 1 0 009.7 3H4a1 1 0 00-1 1v5.7a1 1 0 00.3.7l7 7a1 1 0 001.4 0l5.7-5.7a1 1 0 000-1.4zM6 7.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ShieldCheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M10 2.5l5.5 2v4.2c0 3.5-2.3 6.6-5.5 7.8-3.2-1.2-5.5-4.3-5.5-7.8V4.5L10 2.5z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.7 9.8l1.6 1.6 3-3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BanIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M4.2 4.2l7.6 7.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
}

function UserIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> }
function BuildingIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><path d="M5 15V9h6v6M2 6h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> }
function CreditCardIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3.5" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><path d="M1 7h14" stroke="currentColor" strokeWidth="1.8"/><path d="M4 10.5h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> }
function ShieldIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v4c0 3.5 2.667 5.833 6 7 3.333-1.167 6-3.5 6-7V4L8 1.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg> }
function BranchIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.8"/><circle cx="8" cy="13" r="2" stroke="currentColor" strokeWidth="1.8"/><path d="M4 6v2a4 4 0 004 4M12 6v2a4 4 0 01-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> }
function BellIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2a4.5 4.5 0 0 0-4.5 4.5v3L2 11h12l-1.5-1.5V6.5A4.5 4.5 0 0 0 8 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M6.5 11.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.8"/></svg> }

// ─── Shared modal input style helper ─────────────────────────────────────────

function modalInputStyle(hasError: boolean): React.CSSProperties {
  return {
    height: 38,
    width: '100%',
    borderRadius: 8,
    border: hasError ? '1px solid #FCA5A5' : '0.5px solid var(--dm-border)',
    background: 'var(--dm-bg-card)',
    color: 'var(--dm-text-ink)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 13,
    padding: '0 12px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }
}

// ─── Type Toggle ──────────────────────────────────────────────────────────────

function TypeToggle({ value, onChange }: { value: 'income' | 'expense'; onChange: (v: 'income' | 'expense') => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {(['income', 'expense'] as const).map(t => {
        const active = value === t
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              fontWeight: 500,
              fontSize: 13,
              border: active ? 'none' : '0.5px solid var(--dm-border)',
              background: active
                ? t === 'income' ? '#DCFCE7' : '#FEF3C7'
                : 'var(--dm-bg-muted)',
              color: active
                ? t === 'income' ? '#15803D' : '#B45309'
                : 'var(--dm-text-secondary)',
              transition: 'all 0.12s',
            }}
          >
            {t === 'income' ? 'Income' : 'Expense'}
          </button>
        )
      })}
    </div>
  )
}

// ─── Add Category Modal ───────────────────────────────────────────────────────

function AddCategoryModal({ orgId, onClose, onSuccess }: {
  orgId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('income')
  const [submitting, setSubmitting] = useState(false)
  const [nameError, setNameError] = useState('')

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setNameError('Category name is required'); return }

    setSubmitting(true)
    setNameError('')

    const { data: existing } = await supabase
      .from('transaction_categories')
      .select('id')
      .eq('org_id', orgId)
      .ilike('name', trimmed)
      .limit(1)

    if (existing && existing.length > 0) {
      setNameError('A category with this name already exists')
      setSubmitting(false)
      return
    }

    const { error } = await supabase
      .from('transaction_categories')
      .insert({ org_id: orgId, name: trimmed, type })

    if (error) {
      toast.error('Failed to create category')
    } else {
      toast.success('Category created')
      onSuccess()
      onClose()
    }
    setSubmitting(false)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: 24, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 20 }}>Add Category</div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--dm-text-secondary)', marginBottom: 6, letterSpacing: '0.01em' }}>Name</label>
          <input
            type="text"
            placeholder="e.g. Youth Fund"
            value={name}
            onChange={e => { setName(e.target.value); setNameError('') }}
            onKeyDown={e => e.key === 'Enter' && !submitting && handleSubmit()}
            autoFocus
            style={modalInputStyle(!!nameError)}
          />
          {nameError && <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#EF4444', marginTop: 4 }}>{nameError}</div>}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--dm-text-secondary)', marginBottom: 6 }}>Type</label>
          <TypeToggle value={type} onChange={setType} />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: submitting ? '#A5B4FC' : '#4F6BED', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <PlusIcon /> {submitting ? 'Creating…' : 'Create Category'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Category Modal ──────────────────────────────────────────────────────

function EditCategoryModal({ category, orgId, onClose, onSuccess }: {
  category: Category
  orgId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(category.name)
  const [type, setType] = useState<'income' | 'expense'>(category.type)
  const [submitting, setSubmitting] = useState(false)
  const [nameError, setNameError] = useState('')

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setNameError('Category name is required'); return }

    setSubmitting(true)
    setNameError('')

    const { data: existing } = await supabase
      .from('transaction_categories')
      .select('id')
      .eq('org_id', orgId)
      .ilike('name', trimmed)
      .neq('id', category.id)
      .limit(1)

    if (existing && existing.length > 0) {
      setNameError('A category with this name already exists')
      setSubmitting(false)
      return
    }

    const { error } = await supabase
      .from('transaction_categories')
      .update({ name: trimmed, type })
      .eq('id', category.id)

    if (error) {
      toast.error('Failed to update category')
    } else {
      toast.success('Category updated')
      onSuccess()
      onClose()
    }
    setSubmitting(false)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: 24, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 20 }}>Edit Category</div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--dm-text-secondary)', marginBottom: 6 }}>Name</label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setNameError('') }}
            onKeyDown={e => e.key === 'Enter' && !submitting && handleSave()}
            autoFocus
            style={modalInputStyle(!!nameError)}
          />
          {nameError && <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#EF4444', marginTop: 4 }}>{nameError}</div>}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--dm-text-secondary)', marginBottom: 6 }}>Type</label>
          <TypeToggle value={type} onChange={setType} />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: submitting ? '#A5B4FC' : '#4F6BED', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#fff' }}
          >
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Category Modal ────────────────────────────────────────────────────

function DeleteCategoryModal({ category, onClose, onSuccess }: {
  category: Category
  onClose: () => void
  onSuccess: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase
      .from('transaction_categories')
      .delete()
      .eq('id', category.id)

    if (error) {
      toast.error('Failed to delete category')
    } else {
      toast.success('Category deleted')
      onSuccess()
      onClose()
    }
    setDeleting(false)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: 24, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 8 }}>Delete Category</div>
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          Delete <strong style={{ color: 'var(--dm-text-ink)' }}>{category.name}</strong>? This action cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: deleting ? '#FCA5A5' : '#EF4444', cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <TrashIcon /> {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Categories Content ───────────────────────────────────────────────────────

function CategoriesContent({ orgId }: { orgId: string }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  const fetchCategories = useCallback(async () => {
    setLoading(true)

    const { data: cats, error } = await supabase
      .from('transaction_categories')
      .select('id, org_id, name, type, is_default, created_at')
      .eq('org_id', orgId)
      .order('name')

    if (error) {
      toast.error('Failed to load categories')
      setLoading(false)
      return
    }

    const catIds = (cats ?? []).map(c => c.id)
    const countMap: Record<string, number> = {}

    if (catIds.length > 0) {
      const { data: txData } = await supabase
        .from('transactions')
        .select('category_id')
        .in('category_id', catIds)

      for (const tx of txData ?? []) {
        if (tx.category_id) countMap[tx.category_id] = (countMap[tx.category_id] ?? 0) + 1
      }
    }

    setCategories(
      (cats ?? []).map(c => ({ ...c, usage_count: countMap[c.id] ?? 0 })) as Category[]
    )
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  const canDelete = (cat: Category) => cat.usage_count === 0 && !cat.is_default

  const deleteTooltip = (cat: Category) => {
    if (cat.is_default) return 'Default category cannot be deleted'
    if (cat.usage_count > 0) return `Cannot delete — ${cat.usage_count} transaction${cat.usage_count === 1 ? '' : 's'} use this category`
    return 'Delete category'
  }

  return (
    <>
      {showAdd && (
        <AddCategoryModal orgId={orgId} onClose={() => setShowAdd(false)} onSuccess={fetchCategories} />
      )}
      {editTarget && (
        <EditCategoryModal category={editTarget} orgId={orgId} onClose={() => setEditTarget(null)} onSuccess={fetchCategories} />
      )}
      {deleteTarget && (
        <DeleteCategoryModal category={deleteTarget} onClose={() => setDeleteTarget(null)} onSuccess={fetchCategories} />
      )}

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 3 }}>Transaction Categories</div>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)' }}>Manage giving and expense categories</div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#4F6BED', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#3D59DB')}
          onMouseLeave={e => (e.currentTarget.style.background = '#4F6BED')}
        >
          <PlusIcon /> Add Category
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, overflow: 'hidden' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: i < 3 ? '0.5px solid var(--dm-border-soft)' : 'none' }}>
              <div style={{ height: 13, width: '35%', borderRadius: 4, background: 'var(--dm-bg-muted)', animation: 'cat-pulse 1.5s ease-in-out infinite' }} />
              <div style={{ height: 22, width: 60, borderRadius: 999, background: 'var(--dm-bg-muted)', animation: 'cat-pulse 1.5s ease-in-out infinite' }} />
              <div style={{ flex: 1 }} />
              <div style={{ height: 13, width: 80, borderRadius: 4, background: 'var(--dm-bg-muted)', animation: 'cat-pulse 1.5s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>No categories yet. Add your first category.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', borderBottom: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-subtle)' }}>
            <div style={{ flex: 1, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Name</div>
            <div style={{ width: 70, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Type</div>
            <div style={{ width: 100, textAlign: 'right', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Usage</div>
            <div style={{ width: 64, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}></div>
            <div style={{ width: 64 }}></div>
          </div>

          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="cat-row"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: idx < categories.length - 1 ? '0.5px solid var(--dm-border-soft)' : 'none' }}
            >
              {/* Name */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--dm-text-ink)' }}>{cat.name}</span>
              </div>

              {/* Type badge */}
              <div style={{ width: 70 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', padding: '3px 9px',
                  borderRadius: 999,
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11,
                  background: cat.type === 'income' ? '#DCFCE7' : '#FEF3C7',
                  color: cat.type === 'income' ? '#15803D' : '#B45309',
                }}>
                  {cat.type === 'income' ? 'Income' : 'Expense'}
                </span>
              </div>

              {/* Usage count */}
              <div style={{ width: 100, textAlign: 'right', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)' }}>
                {cat.usage_count} {cat.usage_count === 1 ? 'transaction' : 'transactions'}
              </div>

              {/* Default badge */}
              <div style={{ width: 64 }}>
                {cat.is_default && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, background: '#E8ECF9', color: '#4F6BED', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11 }}>
                    Default
                  </span>
                )}
              </div>

              {/* Actions */}
              <div style={{ width: 64, display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                {/* Edit */}
                <button
                  onClick={() => setEditTarget(cat)}
                  title="Edit category"
                  style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--dm-text-muted)', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#C7D0F8'; e.currentTarget.style.color = '#4F6BED'; e.currentTarget.style.background = '#E8ECF9' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dm-border)'; e.currentTarget.style.color = 'var(--dm-text-muted)'; e.currentTarget.style.background = 'transparent' }}
                >
                  <PencilIcon />
                </button>

                {/* Delete */}
                <button
                  onClick={() => { if (canDelete(cat)) setDeleteTarget(cat) }}
                  title={deleteTooltip(cat)}
                  disabled={!canDelete(cat)}
                  style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--dm-text-muted)', cursor: canDelete(cat) ? 'pointer' : 'not-allowed', opacity: canDelete(cat) ? 1 : 0.38 }}
                  onMouseEnter={e => { if (canDelete(cat)) { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = '#FEF2F2' } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dm-border)'; e.currentTarget.style.color = 'var(--dm-text-muted)'; e.currentTarget.style.background = 'transparent' }}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── Role / Branch shared form fields ─────────────────────────────────────────

function modalLabelStyle(): React.CSSProperties {
  return { display: 'block', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--dm-text-secondary)', marginBottom: 6, letterSpacing: '0.01em' }
}

function RoleBranchFields({ role, branchId, branches, branchError, onRoleChange, onBranchChange }: {
  role: UserRoleEntry['role']
  branchId: string
  branches: BranchOption[]
  branchError?: string
  onRoleChange: (v: UserRoleEntry['role']) => void
  onBranchChange: (v: string) => void
}) {
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <label style={modalLabelStyle()}>Role</label>
        <select
          value={role}
          onChange={e => onRoleChange(e.target.value as UserRoleEntry['role'])}
          style={{ ...modalInputStyle(false), cursor: 'pointer' }}
        >
          {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {role !== 'super_admin' && (
        <div style={{ marginBottom: 16 }}>
          <label style={modalLabelStyle()}>Branch</label>
          <select
            value={branchId}
            onChange={e => onBranchChange(e.target.value)}
            style={{ ...modalInputStyle(!!branchError), cursor: 'pointer' }}
          >
            <option value="">Select a branch…</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {branchError && <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#EF4444', marginTop: 4 }}>{branchError}</div>}
        </div>
      )}
    </>
  )
}

// ─── Invite User Modal ────────────────────────────────────────────────────────

function InviteUserModal({ branches, onClose, onSuccess }: {
  branches: BranchOption[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRoleEntry['role']>('admin')
  const [branchId, setBranchId] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; branch?: string }>({})

  const handleSubmit = async () => {
    const trimmedEmail = email.trim()
    const nextErrors: { email?: string; branch?: string } = {}
    if (!trimmedEmail) nextErrors.email = 'Email is required'
    if (role !== 'super_admin' && !branchId) nextErrors.branch = 'Branch is required'
    if (Object.keys(nextErrors).length > 0) { setErrors(nextErrors); return }

    setSaving(true)
    setErrors({})

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      toast.error('Your session expired. Please log in again.')
      setSaving(false)
      return
    }

    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: {
        email: trimmedEmail,
        role,
        branchId: role === 'super_admin' ? null : branchId,
      },
    })

    setSaving(false)

    if (error || data?.error) {
      const message = data?.error || error?.message || 'Failed to assign role'
      setErrors({ email: message })
      return
    }

    toast.success(
      data?.wasExisting
        ? 'Role assigned successfully'
        : 'Invitation sent — they will receive an email to set up their account'
    )
    onSuccess()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: 24, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 20 }}>Assign Role</div>

        <div style={{ marginBottom: 16 }}>
          <label style={modalLabelStyle()}>Email Address</label>
          <input
            type="email"
            placeholder="team@church.com"
            value={email}
            onChange={e => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })) }}
            autoFocus
            style={modalInputStyle(!!errors.email)}
          />
          {errors.email && <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#EF4444', marginTop: 4, lineHeight: 1.5 }}>{errors.email}</div>}
        </div>

        <RoleBranchFields
          role={role}
          branchId={branchId}
          branches={branches}
          branchError={errors.branch}
          onRoleChange={v => { setRole(v); setErrors(prev => ({ ...prev, branch: undefined })) }}
          onBranchChange={v => { setBranchId(v); setErrors(prev => ({ ...prev, branch: undefined })) }}
        />

        <div style={{ background: '#E8ECF9', borderRadius: 8, padding: 12, marginBottom: 24, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#3D4B86', lineHeight: 1.5 }}>
          If this email doesn't have an account yet, we'll send them an invite to set one up. If they already have an account, their role is assigned immediately.
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: saving ? '#A5B4FC' : '#4F6BED', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <PlusIcon /> {saving ? 'Assigning…' : 'Assign Role'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Role Modal ──────────────────────────────────────────────────────────

function EditRoleModal({ entry, branches, onClose, onSuccess }: {
  entry: UserRoleEntry
  branches: BranchOption[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [role, setRole] = useState<UserRoleEntry['role']>(entry.role)
  const [branchId, setBranchId] = useState(entry.branch_id ?? '')
  const [saving, setSaving] = useState(false)
  const [branchError, setBranchError] = useState('')

  const handleSubmit = async () => {
    if (role !== 'super_admin' && !branchId) { setBranchError('Branch is required'); return }

    setSaving(true)
    setBranchError('')

    const { error } = await supabase
      .from('user_roles')
      .update({ role, branch_id: role === 'super_admin' ? null : branchId })
      .eq('id', entry.id)

    if (error) {
      toast.error('Failed to update role')
      setSaving(false)
      return
    }

    toast.success('Role updated')
    onSuccess()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: 24, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 4 }}>Edit Role</div>
        {entry.profile && (
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)', marginBottom: 20 }}>{entry.profile.full_name} · {entry.profile.email}</div>
        )}
        {!entry.profile && <div style={{ marginBottom: 20 }} />}

        <RoleBranchFields
          role={role}
          branchId={branchId}
          branches={branches}
          branchError={branchError}
          onRoleChange={v => { setRole(v); setBranchError('') }}
          onBranchChange={v => { setBranchId(v); setBranchError('') }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: saving ? '#A5B4FC' : '#4F6BED', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#fff' }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Access Control Tab ───────────────────────────────────────────────────────

function AccessControlTab({ orgId }: { orgId: string }) {
  const [userRoles, setUserRoles] = useState<UserRoleEntry[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [editTarget, setEditTarget] = useState<UserRoleEntry | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)

    const [rolesRes, branchesRes] = await Promise.all([
      supabase
        .from('user_roles')
        .select('id, user_id, role, branch_id, is_active, profile:profiles!user_roles_user_id_fkey(full_name, email), branch:branches!user_roles_branch_id_fkey(name)')
        .eq('org_id', orgId)
        .order('role'),
      supabase
        .from('branches')
        .select('id, name')
        .eq('org_id', orgId)
        .order('name'),
    ])

    if (rolesRes.error) {
      toast.error('Failed to load access control')
      setLoading(false)
      return
    }

    const rows = (rolesRes.data ?? []) as Record<string, unknown>[]
    setUserRoles(rows.map(r => ({
      id: r.id as string,
      user_id: r.user_id as string,
      role: r.role as UserRoleEntry['role'],
      branch_id: (r.branch_id as string | null) ?? null,
      is_active: r.is_active as boolean,
      profile: normalizeRel(r.profile as UserRoleEntry['profile'] | UserRoleEntry['profile'][]),
      branch: normalizeRel(r.branch as UserRoleEntry['branch'] | UserRoleEntry['branch'][]),
    })))
    setBranches((branchesRes.data ?? []) as BranchOption[])
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRevoke = async (entry: UserRoleEntry) => {
    if (!window.confirm("Revoke this user's access?")) return

    const { error } = await supabase
      .from('user_roles')
      .update({ is_active: false })
      .eq('id', entry.id)

    if (error) {
      toast.error('Failed to revoke access')
      return
    }

    toast.success('Access revoked')
    fetchData()
  }

  return (
    <>
      {showInvite && (
        <InviteUserModal branches={branches} onClose={() => setShowInvite(false)} onSuccess={() => { setShowInvite(false); fetchData() }} />
      )}
      {editTarget && (
        <EditRoleModal entry={editTarget} branches={branches} onClose={() => setEditTarget(null)} onSuccess={() => { setEditTarget(null); fetchData() }} />
      )}

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 20, color: '#1B2352', letterSpacing: '-0.02em' }}>Access Control</div>
        <button
          onClick={() => setShowInvite(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#4F6BED', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#3D59DB')}
          onMouseLeave={e => (e.currentTarget.style.background = '#4F6BED')}
        >
          <PlusIcon /> Assign Role
        </button>
      </div>
      <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)', lineHeight: 1.6, marginBottom: 20, maxWidth: 620 }}>
        Manage who has access to Centry CMS and what they can do. Each user has one role assigned to one branch.
      </div>

      {/* Roles legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        {ROLE_LEGEND.map(item => {
          const roleColor = ROLE_BADGE_COLOR[item.role]
          return (
            <div
              key={item.role}
              style={{
                flex: 1,
                minWidth: 0,
                background: 'var(--dm-bg-card)',
                border: `2px solid ${roleColor}`,
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 8,
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: `${roleColor}1F`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: roleColor,
                margin: '0 auto 8px',
              }}>
                <ShieldCheckIcon />
              </div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#1B2352', textAlign: 'center' }}>{item.name}</div>
              <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#6B7280', lineHeight: 1.5, textAlign: 'center' }}>{item.desc}</div>
            </div>
          )
        })}
      </div>

      {/* Users table */}
      {loading ? (
        <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, overflow: 'hidden' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: i < 3 ? '0.5px solid var(--dm-border-soft)' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--dm-bg-muted)', animation: 'cat-pulse 1.5s ease-in-out infinite' }} />
              <div style={{ height: 13, width: '30%', borderRadius: 4, background: 'var(--dm-bg-muted)', animation: 'cat-pulse 1.5s ease-in-out infinite' }} />
              <div style={{ flex: 1 }} />
              <div style={{ height: 22, width: 80, borderRadius: 999, background: 'var(--dm-bg-muted)', animation: 'cat-pulse 1.5s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
      ) : userRoles.length === 0 ? (
        <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>No users assigned yet. Click + Assign Role to get started.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', borderBottom: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-subtle)' }}>
            <div style={{ flex: 1, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>User</div>
            <div style={{ width: 130, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Role</div>
            <div style={{ width: 150, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Branch</div>
            <div style={{ width: 84, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Status</div>
            <div style={{ width: 64, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', textAlign: 'right' }}>Actions</div>
          </div>

          {userRoles.map((entry, idx) => {
            const name = entry.profile?.full_name || entry.profile?.email || 'Unknown'
            const { bg, color } = avatarColor(name)
            return (
              <div
                key={entry.id}
                className="cat-row"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: idx < userRoles.length - 1 ? '0.5px solid var(--dm-border-soft)' : 'none' }}
              >
                {/* User */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg, color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {initialsOf(name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--dm-text-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.profile?.full_name || '—'}</div>
                    <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.profile?.email || ''}</div>
                  </div>
                </div>

                {/* Role badge */}
                <div style={{ width: 130 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, background: ROLE_BADGE_COLOR[entry.role], color: '#fff' }}>
                    {ROLE_LABELS[entry.role] ?? entry.role}
                  </span>
                </div>

                {/* Branch */}
                <div style={{ width: 150, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.branch_id === null ? 'All Branches' : (entry.branch?.name ?? '—')}
                </div>

                {/* Status */}
                <div style={{ width: 84 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999,
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11,
                    background: entry.is_active ? '#DCFCE7' : '#FEF2F2',
                    color: entry.is_active ? '#15803D' : '#EF4444',
                  }}>
                    {entry.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ width: 64, display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setEditTarget(entry)}
                    title="Edit role"
                    style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--dm-text-muted)', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#C7D0F8'; e.currentTarget.style.color = '#4F6BED'; e.currentTarget.style.background = '#E8ECF9' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dm-border)'; e.currentTarget.style.color = 'var(--dm-text-muted)'; e.currentTarget.style.background = 'transparent' }}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    onClick={() => handleRevoke(entry)}
                    title={entry.is_active ? 'Revoke access' : 'Access already revoked'}
                    disabled={!entry.is_active}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--dm-text-muted)', cursor: entry.is_active ? 'pointer' : 'not-allowed', opacity: entry.is_active ? 1 : 0.38 }}
                    onMouseEnter={e => { if (entry.is_active) { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = '#FEF2F2' } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dm-border)'; e.currentTarget.style.color = 'var(--dm-text-muted)'; e.currentTarget.style.background = 'transparent' }}
                  >
                    <BanIcon />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [saving, setSaving] = useState(false)
  const [branchName, setBranchName] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    if (user.branch_id) {
      supabase.from('branches').select('name').eq('id', user.branch_id).single()
        .then(({ data }) => { if (data) setBranchName(data.name) })
    } else {
      setBranchName('All Branches')
    }
  }, [user?.branch_id])

  const handleSave = async () => {
    if (!user?.id) return
    const trimmed = fullName.trim()
    if (!trimmed) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: trimmed })
      .eq('id', user.id)
    setSaving(false)
    if (error) { toast.error('Failed to update profile') } else { toast.success('Profile updated') }
  }

  const pal = avatarColor(user?.full_name ?? 'U')
  const initials = user?.full_name ? initialsOf(user.full_name) : '?'

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: pal.bg, color: pal.color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          {initials}
        </div>
        <button style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#4F6BED', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          Upload photo
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={modalLabelStyle()}>Full Name</label>
        <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={modalInputStyle(false)} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={modalLabelStyle()}>Email Address</label>
        <input type="email" value={user?.email ?? ''} readOnly style={{ ...modalInputStyle(false), background: 'var(--dm-bg-muted)', color: 'var(--dm-text-secondary)', cursor: 'not-allowed' }} />
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)', marginTop: 4 }}>Contact your Super Admin to change your email</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={modalLabelStyle()}>Role</label>
        <input type="text" value={ROLE_LABELS[user?.role ?? ''] ?? (user?.role ?? '')} readOnly style={{ ...modalInputStyle(false), background: 'var(--dm-bg-muted)', color: 'var(--dm-text-secondary)', cursor: 'not-allowed' }} />
      </div>

      <div style={{ marginBottom: 28 }}>
        <label style={modalLabelStyle()}>Branch</label>
        <input type="text" value={branchName ?? '…'} readOnly style={{ ...modalInputStyle(false), background: 'var(--dm-bg-muted)', color: 'var(--dm-text-secondary)', cursor: 'not-allowed' }} />
      </div>

      <button onClick={handleSave} disabled={saving} style={{ height: 36, padding: '0 20px', borderRadius: 8, border: 'none', background: saving ? '#A5B4FC' : '#4F6BED', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#fff' }}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}

// ─── General Tab ──────────────────────────────────────────────────────────────

function GeneralTab({ orgId }: { orgId: string }) {
  const [orgName, setOrgName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('organisations').select('name').eq('id', orgId).single()
      .then(({ data }) => { if (data) setOrgName(data.name) })
  }, [orgId])

  const handleSave = async () => {
    const trimmed = orgName.trim()
    if (!trimmed) return
    setSaving(true)
    const { error } = await supabase.from('organisations').update({ name: trimmed }).eq('id', orgId)
    setSaving(false)
    if (error) { toast.error('Failed to update organisation') } else { toast.success('Organisation updated'); window.dispatchEvent(new CustomEvent('org-name-updated')) }
  }

  const readOnly: React.CSSProperties = { ...modalInputStyle(false), background: 'var(--dm-bg-muted)', color: 'var(--dm-text-secondary)', cursor: 'not-allowed' }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 2 }}>Organisation Profile</div>
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)', marginBottom: 24 }}>Manage your church's general information</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={modalLabelStyle()}>Organisation Name</label>
        <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} style={modalInputStyle(false)} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={modalLabelStyle()}>Country</label>
        <input type="text" value="Ghana" readOnly style={readOnly} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={modalLabelStyle()}>Currency</label>
        <input type="text" value="GHS — Ghanaian Cedi" readOnly style={readOnly} />
      </div>

      <div style={{ marginBottom: 28 }}>
        <label style={modalLabelStyle()}>Timezone</label>
        <input type="text" value="Africa/Accra (GMT+0)" readOnly style={readOnly} />
      </div>

      <button onClick={handleSave} disabled={saving} style={{ height: 36, padding: '0 20px', borderRadius: 8, border: 'none', background: saving ? '#A5B4FC' : '#4F6BED', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#fff' }}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}

// ─── Branches Tab ─────────────────────────────────────────────────────────────

interface BranchRow { id: string; name: string; is_main_branch: boolean; is_active: boolean }

function AddBranchModal({ orgId, onClose, onSuccess }: { orgId: string; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setNameError('Branch name is required'); return }
    setSaving(true)
    const { error } = await supabase.from('branches').insert({ org_id: orgId, name: trimmed, is_active: true })
    setSaving(false)
    if (error) { toast.error('Failed to create branch') } else { toast.success('Branch created'); onSuccess(); onClose() }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: 24, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 20 }}>Add Branch</div>
        <div style={{ marginBottom: 24 }}>
          <label style={modalLabelStyle()}>Branch Name</label>
          <input type="text" placeholder="e.g. Main Campus" value={name} onChange={e => { setName(e.target.value); setNameError('') }} onKeyDown={e => e.key === 'Enter' && !saving && handleSubmit()} autoFocus style={modalInputStyle(!!nameError)} />
          {nameError && <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: '#EF4444', marginTop: 4 }}>{nameError}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-body)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--dm-bg-muted)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--dm-bg-card)')}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: saving ? '#A5B4FC' : '#4F6BED', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <PlusIcon /> {saving ? 'Creating…' : 'Create Branch'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BranchesTab({ orgId }: { orgId: string }) {
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const fetchBranches = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('branches').select('id, name, is_main_branch, is_active').eq('org_id', orgId).order('name')
    setBranches((data ?? []) as BranchRow[])
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchBranches() }, [fetchBranches])

  const startEdit = (branch: BranchRow) => { setEditingId(branch.id); setEditingName(branch.name) }

  const saveEdit = async (id: string) => {
    const trimmed = editingName.trim()
    if (!trimmed) return
    const { error } = await supabase.from('branches').update({ name: trimmed }).eq('id', id)
    if (error) { toast.error('Failed to update branch') } else { toast.success('Branch updated'); fetchBranches() }
    setEditingId(null)
  }

  const handleDelete = async (branch: BranchRow) => {
    if (branch.is_main_branch) { toast.error('Cannot delete the main branch'); return }
    if (!window.confirm(`Delete branch "${branch.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('branches').delete().eq('id', branch.id)
    if (error) { toast.error('Failed to delete branch') } else { toast.success('Branch deleted'); fetchBranches() }
  }

  return (
    <>
      {showAdd && <AddBranchModal orgId={orgId} onClose={() => setShowAdd(false)} onSuccess={fetchBranches} />}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 3 }}>Branches</div>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)' }}>Manage your church's locations and campuses</div>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#4F6BED', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.background = '#3D59DB')} onMouseLeave={e => (e.currentTarget.style.background = '#4F6BED')}>
          <PlusIcon /> Add Branch
        </button>
      </div>

      {loading ? (
        <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, overflow: 'hidden' }}>
          {[1, 2].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: i < 2 ? '0.5px solid var(--dm-border-soft)' : 'none' }}>
              <div style={{ height: 13, width: '40%', borderRadius: 4, background: 'var(--dm-bg-muted)', animation: 'cat-pulse 1.5s ease-in-out infinite' }} />
              <div style={{ flex: 1 }} />
              <div style={{ height: 22, width: 60, borderRadius: 999, background: 'var(--dm-bg-muted)', animation: 'cat-pulse 1.5s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
      ) : branches.length === 0 ? (
        <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>No branches yet. Add your first branch.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', borderBottom: '0.5px solid var(--dm-border-soft)', background: 'var(--dm-bg-subtle)' }}>
            <div style={{ flex: 1, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Branch Name</div>
            <div style={{ width: 90, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Members</div>
            <div style={{ width: 80, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--dm-text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Status</div>
            <div style={{ width: 64 }} />
          </div>
          {branches.map((branch, idx) => (
            <div key={branch.id} className="cat-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: idx < branches.length - 1 ? '0.5px solid var(--dm-border-soft)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === branch.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(branch.id); if (e.key === 'Escape') setEditingId(null) }}
                    autoFocus
                    style={{ ...modalInputStyle(false), height: 30, fontSize: 13 }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--dm-text-ink)' }}>{branch.name}</span>
                    {branch.is_main_branch && <span style={{ display: 'inline-flex', padding: '2px 7px', borderRadius: 6, background: '#E8ECF9', color: '#4F6BED', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 500, fontSize: 11 }}>Main</span>}
                  </div>
                )}
              </div>
              <div style={{ width: 90, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--dm-text-muted)' }}>—</div>
              <div style={{ width: 80 }}>
                <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 999, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 11, background: branch.is_active ? '#DCFCE7' : '#FEF2F2', color: branch.is_active ? '#15803D' : '#EF4444' }}>
                  {branch.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div style={{ width: 64, display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                {editingId === branch.id ? (
                  <>
                    <button onClick={() => saveEdit(branch.id)} title="Save" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#4F6BED', display: 'grid', placeItems: 'center', color: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 600 }}>✓</button>
                    <button onClick={() => setEditingId(null)} title="Cancel" style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--dm-text-muted)', cursor: 'pointer' }}>✕</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(branch)} title="Edit branch" style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--dm-text-muted)', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#C7D0F8'; e.currentTarget.style.color = '#4F6BED'; e.currentTarget.style.background = '#E8ECF9' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dm-border)'; e.currentTarget.style.color = 'var(--dm-text-muted)'; e.currentTarget.style.background = 'transparent' }}>
                      <PencilIcon />
                    </button>
                    <button onClick={() => handleDelete(branch)} title={branch.is_main_branch ? 'Cannot delete main branch' : 'Delete branch'} disabled={branch.is_main_branch} style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid var(--dm-border)', background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--dm-text-muted)', cursor: branch.is_main_branch ? 'not-allowed' : 'pointer', opacity: branch.is_main_branch ? 0.38 : 1 }}
                      onMouseEnter={e => { if (!branch.is_main_branch) { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = '#FEF2F2' } }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dm-border)'; e.currentTarget.style.color = 'var(--dm-text-muted)'; e.currentTarget.style.background = 'transparent' }}>
                      <TrashIcon />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── Billing Tab ──────────────────────────────────────────────────────────────

function BillingTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 260, gap: 16, textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E8ECF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CreditCardIcon />
      </div>
      <div>
        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: '#FEF3C7', color: '#C8964A', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', marginBottom: 10 }}>PLANNED</span>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 6 }}>Billing &amp; Subscription</div>
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)', maxWidth: 380, lineHeight: 1.6 }}>
          Manage your plan, usage limits, and payment details. Coming in a future update.
        </div>
      </div>
    </div>
  )
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 260, gap: 16, textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E8ECF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <BellIcon />
      </div>
      <div>
        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: '#FEF3C7', color: '#C8964A', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', marginBottom: 10 }}>COMING SOON</span>
        <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--dm-text-ink)', marginBottom: 6 }}>Notifications</div>
        <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)', maxWidth: 380, lineHeight: 1.6 }}>
          Configure email and in-app notifications for key events. Coming in a future update.
        </div>
      </div>
    </div>
  )
}

// ─── Settings Page ────────────────────────────────────────────────────────────

export function SettingsPage({ modal = false }: { modal?: boolean }) {
  const { user } = useAuth()
  const { activeTab, setActiveTab } = useSettings()
  const { isMobile } = useSidebar()

  const role = user?.role
  const showGeneral = role === 'super_admin'
  const showBranches = role === 'super_admin'
  const showAccessControl = role === 'super_admin'
  const showBilling = role === 'super_admin'
  const showCategories = role === 'super_admin' || role === 'admin' || role === 'finance_officer'
  // Profile and Notifications: all roles, no guard needed

  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'My Profile', icon: <UserIcon /> },
    ...(showGeneral ? [{ key: 'general' as const, label: 'General', icon: <BuildingIcon /> }] : []),
    ...(showBranches ? [{ key: 'branches' as const, label: 'Branches', icon: <BranchIcon /> }] : []),
    ...(showAccessControl ? [{ key: 'access_control' as const, label: 'Access Control', icon: <ShieldIcon /> }] : []),
    ...(showBilling ? [{ key: 'billing' as const, label: 'Billing', icon: <CreditCardIcon /> }] : []),
    ...(showCategories ? [{ key: 'categories' as const, label: 'Categories', icon: <TagIcon /> }] : []),
    { key: 'notifications', label: 'Notifications', icon: <BellIcon /> },
  ]

  const currentTab = activeTab as SettingsTab

  // Mobile + modal: horizontal tab row; otherwise: vertical left nav
  const mobileTabRow = modal && isMobile

  return (
    <>
      <style>{`
        @keyframes cat-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }
        .cat-row:hover { background: var(--dm-bg-muted) !important; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: mobileTabRow ? 'column' : 'row', height: modal ? '100%' : 'auto', overflow: modal ? 'hidden' : 'visible' }}>

        {/* Tab navigation */}
        {mobileTabRow ? (
          // Mobile: horizontal scrollable row
          <div style={{ display: 'flex', flexDirection: 'row', overflowX: 'auto', borderBottom: '0.5px solid var(--dm-border-soft)', gap: 0, padding: '0 16px', flexShrink: 0 }}>
            {tabs.map(tab => {
              const active = currentTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '12px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: active ? '3px solid #4F6BED' : '3px solid transparent',
                    cursor: 'pointer',
                    color: active ? '#4F6BED' : 'var(--dm-text-secondary)',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: active ? 600 : 400,
                    fontSize: 13,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'color 0.1s, border-color 0.1s',
                  }}
                >
                  <span style={{ display: 'inline-flex', flexShrink: 0 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              )
            })}
          </div>
        ) : (
          // Desktop: vertical left nav
          <div style={{
            width: modal ? 200 : 196,
            flexShrink: 0,
            background: modal ? 'var(--dm-bg-subtle)' : 'var(--dm-bg-card)',
            border: modal ? 'none' : '0.5px solid var(--dm-border)',
            borderRight: modal ? '0.5px solid var(--dm-border-soft)' : undefined,
            borderRadius: modal ? 0 : 12,
            overflowY: 'auto',
            padding: '8px 0',
          }}>
            {tabs.map(tab => {
              const active = currentTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                    padding: '9px 14px',
                    background: active ? '#E8ECF9' : 'transparent',
                    borderLeft: active ? '2.5px solid #4F6BED' : '2.5px solid transparent',
                    borderRight: 'none', borderTop: 'none', borderBottom: 'none',
                    cursor: 'pointer',
                    color: active ? '#4F6BED' : 'var(--dm-text-secondary)',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: active ? 600 : 400,
                    fontSize: 13,
                    textAlign: 'left',
                    transition: 'background 0.1s, color 0.1s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--dm-bg-muted)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ display: 'inline-flex', flexShrink: 0 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Content area */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: modal ? 24 : 0, paddingLeft: modal && !mobileTabRow ? 28 : modal ? 24 : 20 }}>
          {currentTab === 'profile' && <ProfileTab />}
          {user?.org_id && currentTab === 'general' && showGeneral && <GeneralTab orgId={user.org_id} />}
          {user?.org_id && currentTab === 'branches' && showBranches && <BranchesTab orgId={user.org_id} />}
          {user?.org_id && currentTab === 'access_control' && showAccessControl && <AccessControlTab orgId={user.org_id} />}
          {currentTab === 'billing' && showBilling && <BillingTab />}
          {user?.org_id && currentTab === 'categories' && showCategories && <CategoriesContent orgId={user.org_id} />}
          {currentTab === 'notifications' && <NotificationsTab />}
          {!user?.org_id && (
            <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>Loading…</div>
          )}
        </div>
      </div>
    </>
  )
}

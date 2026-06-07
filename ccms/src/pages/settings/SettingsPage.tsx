import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

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

type SettingsTab = 'categories'

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

// ─── Settings Page ────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<SettingsTab>('categories')

  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'categories', label: 'Categories', icon: <TagIcon /> },
  ]

  return (
    <>
      <style>{`
        @keyframes cat-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }
        .cat-row:hover { background: var(--dm-bg-muted) !important; }
      `}</style>

      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: 20, color: 'var(--dm-text-ink)', letterSpacing: '-0.02em', margin: '0 0 4px' }}>
          Settings
        </h1>
        <p style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-secondary)', margin: 0 }}>
          Configure your organisation
        </p>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Sidebar nav */}
        <div style={{ width: 196, flexShrink: 0, background: 'var(--dm-bg-card)', border: '0.5px solid var(--dm-border)', borderRadius: 12, overflow: 'hidden', padding: '6px 0' }}>
          {tabs.map(tab => {
            const active = activeTab === tab.key
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

        {/* Content area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {user?.org_id && activeTab === 'categories' && (
            <CategoriesContent orgId={user.org_id} />
          )}
          {!user?.org_id && (
            <div style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--dm-text-muted)' }}>Loading…</div>
          )}
        </div>
      </div>
    </>
  )
}

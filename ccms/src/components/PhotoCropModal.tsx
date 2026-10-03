import { useState } from 'react'
import Cropper from 'react-easy-crop'

export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

export async function cropToSquareBlob(src: string, area: CropArea): Promise<Blob> {
  const img = document.createElement('img')
  img.crossOrigin = 'anonymous'
  img.src = src
  await new Promise((res, rej) => {
    img.onload = res
    img.onerror = () => rej(new Error('image load failed'))
  })
  const size = Math.max(1, Math.round(Math.min(area.width, area.height)))
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, area.x, area.y, size, size, 0, 0, size, size)
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(b => resolve(b), 'image/jpeg', 0.9)
  })
  if (!blob || blob.size === 0) throw new Error('crop produced an empty image')
  return blob
}

interface PhotoCropModalProps {
  src: string
  busy?: boolean
  title?: string
  onCancel: () => void
  onSave: (blob: Blob) => void | Promise<void>
}

export function PhotoCropModal({ src, busy, title = 'Position your photo', onCancel, onSave }: PhotoCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<CropArea | null>(null)
  const [saving, setSaving] = useState(false)

  const working = busy || saving

  const handleSave = async () => {
    if (!croppedArea) return
    setSaving(true)
    try {
      const blob = await cropToSquareBlob(src, croppedArea)
      await onSave(blob)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={() => !working && onCancel()}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--dm-bg-card)', borderRadius: 14,
          width: '100%', maxWidth: 380, overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{
          padding: '14px 18px',
          borderBottom: '0.5px solid var(--dm-border-soft)',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontWeight: 700, fontSize: 15, color: 'var(--dm-text-ink)',
        }}>
          {title}
        </div>
        <div style={{ position: 'relative', width: '100%', height: 300, background: '#1B2352' }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_area: unknown, areaPixels: CropArea) => setCroppedArea(areaPixels)}
          />
        </div>
        <div style={{ padding: '14px 18px' }}>
          <div style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 12, color: 'var(--dm-text-secondary)', marginBottom: 8,
          }}>
            Drag to reposition, slide to zoom
          </div>
          <input
            type="range" min={1} max={3} step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#4F6BED' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={working}
              style={{
                height: 34, padding: '0 16px', borderRadius: 8,
                border: '0.5px solid var(--dm-border)', background: 'var(--dm-bg-card)',
                cursor: working ? 'not-allowed' : 'pointer',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: 13, color: 'var(--dm-text-body)',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={working || !croppedArea}
              style={{
                height: 34, padding: '0 16px', borderRadius: 8,
                border: 'none',
                background: working ? '#A5B4FC' : '#4F6BED',
                cursor: working ? 'not-allowed' : 'pointer',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontWeight: 600, fontSize: 13, color: '#fff',
              }}
            >
              {working ? 'Saving…' : 'Save photo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

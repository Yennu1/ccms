import { useState, useEffect } from 'react'

const PALETTE = [
  { bg: '#E8ECF9', color: '#4F6BED' },
  { bg: '#DCFCE7', color: '#15803D' },
  { bg: '#FEF3C7', color: '#B45309' },
  { bg: '#FCE7F3', color: '#BE185D' },
  { bg: '#EEF2FF', color: '#4338CA' },
  { bg: '#FFF7ED', color: '#C2410C' },
  { bg: '#F0FDFA', color: '#0F766E' },
  { bg: '#F5F3FF', color: '#7C3AED' },
]

function avatarPalette(first: string, last: string) {
  const s = (first + last).toLowerCase()
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

interface Props {
  firstName: string
  lastName: string
  photoUrl?: string | null
  size?: number
  className?: string
}

export function MemberAvatar({ firstName, lastName, photoUrl, size = 40, className }: Props) {
  const [imgFailed, setImgFailed] = useState(false)
  useEffect(() => { setImgFailed(false) }, [photoUrl])

  const showPhoto = !!photoUrl && !imgFailed
  const { bg, color } = avatarPalette(firstName, lastName)
  const fontSize = Math.max(Math.round(size * 0.35), 10)

  return (
    <div
      className={className}
      style={{
        width: size, height: size, borderRadius: '50%',
        flexShrink: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: showPhoto ? 'transparent' : bg,
        color, fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontWeight: 600, fontSize,
      }}
    >
      {showPhoto ? (
        <img
          src={photoUrl!}
          alt={`${firstName} ${lastName}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setImgFailed(true)}
        />
      ) : `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()}
    </div>
  )
}

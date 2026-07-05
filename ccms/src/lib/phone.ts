// Normalizes a Ghanaian phone number into international format for wa.me links.
// Handles local format (0244123456), stray formatting characters (dashes,
// spaces), and numbers already in international format.
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.length === 0) return null
  if (digits.startsWith('233')) return digits
  if (digits.startsWith('0') && digits.length === 10) return '233' + digits.slice(1)
  if (digits.length === 9) return '233' + digits
  return null // unrecognized format — caller should handle null by disabling the button
}

export function buildWhatsAppLink(phone: string | null | undefined, message: string): string | null {
  const number = toWhatsAppNumber(phone)
  if (!number) return null
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

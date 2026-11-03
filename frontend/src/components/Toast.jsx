import { useEffect, memo } from 'react'
import { X, AlertTriangle, CheckCircle2, Clock, ShoppingCart } from 'lucide-react'

const ICONS = {
  success: <CheckCircle2 size={18} />,
  error: <AlertTriangle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Clock size={18} />,
  cart: <ShoppingCart size={18} />,
}

const COLORS = {
  success: { bg: '#0A2A1A', border: '#00FF88', text: '#00FF88' },
  error:   { bg: '#2A0A0A', border: '#FF3C00', text: '#FF6B4A' },
  warning: { bg: '#2A1A00', border: '#FFB800', text: '#FFB800' },
  info:    { bg: '#0A1A2A', border: '#4A8FFF', text: '#4A8FFF' },
  cart:    { bg: '#1A0A2A', border: '#9B59FF', text: '#9B59FF' },
}

const Toast = memo(function Toast({ message, type = 'info', onClose, duration = 5000 }) {
  useEffect(() => {
    if (!duration) return
    const id = setTimeout(onClose, duration)
    return () => clearTimeout(id)
  }, [duration, onClose])

  const c = COLORS[type] || COLORS.info

  return (
    <div
      className="animate-slide-up flex items-start gap-3 px-4 py-3 rounded-lg max-w-sm pointer-events-auto"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        boxShadow: `0 0 20px ${c.border}22`,
      }}
    >
      <span style={{ color: c.text, flexShrink: 0, marginTop: 2 }}>
        {ICONS[type]}
      </span>
      <p className="font-body text-sm leading-snug flex-1" style={{ color: 'var(--text)' }}>
        {message}
      </p>
      <button
        onClick={onClose}
        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        style={{ color: 'var(--text)' }}
      >
        <X size={14} />
      </button>
    </div>
  )
})

export default Toast
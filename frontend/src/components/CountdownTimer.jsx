import { useState, useEffect, useRef, memo } from 'react'
import { Zap } from 'lucide-react'

// Server-synchronized countdown timer
const CountdownTimer = memo(function CountdownTimer({ saleStartsAt, serverOffset = 0, onSaleStart }) {
  const [timeLeft, setTimeLeft] = useState(null)
  const callbackRef = useRef(onSaleStart)
  callbackRef.current = onSaleStart

  useEffect(() => {
    const tick = () => {
      const currentServerTime = Date.now() + serverOffset
      const diff = Math.max(0, saleStartsAt - currentServerTime)
      setTimeLeft(diff)
      if (diff === 0) callbackRef.current?.()
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [saleStartsAt, serverOffset])

  if (timeLeft === null) return null

  const totalSec = Math.floor(timeLeft / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  const pad = (n) => String(n).padStart(2, '0')

  const Unit = ({ value, label }) => {
    const prevRef = useRef(value)
    const changed = prevRef.current !== value
    prevRef.current = value

    return (
      <div className="flex flex-col items-center">
        <div
          className="font-display text-5xl sm:text-7xl leading-none overflow-hidden"
          style={{ color: 'var(--text)', minWidth: '2ch', textAlign: 'center' }}
        >
          <span key={value} className={changed ? 'digit-flip' : ''}>
            {pad(value)}
          </span>
        </div>
        <span className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
          {label}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2 mb-1">
        <Zap size={14} fill="currentColor" style={{ color: 'var(--fire)' }} />
        <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--fire)' }}>
          Sale drops in (Server Synced)
        </span>
        <Zap size={14} fill="currentColor" style={{ color: 'var(--fire)' }} />
      </div>

      <div className="flex items-end gap-3 sm:gap-5">
        <Unit value={hours} label="HRS" />
        <span className="font-display text-4xl sm:text-6xl pb-5" style={{ color: 'var(--text-muted)' }}>:</span>
        <Unit value={minutes} label="MIN" />
        <span className="font-display text-4xl sm:text-6xl pb-5" style={{ color: 'var(--text-muted)' }}>:</span>
        <Unit value={seconds} label="SEC" />
      </div>
    </div>
  )
})

export default CountdownTimer

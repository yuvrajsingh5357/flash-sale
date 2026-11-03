import { useEffect, useRef, memo } from 'react'

const COLORS = ['#FF3C00', '#FFB800', '#00FF88', '#4A8FFF', '#FF59F8', '#FFFFFF']

const Confetti = memo(function Confetti() {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const pieces = []
    for (let i = 0; i < 80; i++) {
      const el = document.createElement('div')
      el.className = 'confetti-piece'
      el.style.left = Math.random() * 100 + 'vw'
      el.style.top = '-20px'
      el.style.backgroundColor = COLORS[Math.floor(Math.random() * COLORS.length)]
      el.style.borderRadius = Math.random() > 0.5 ? '50%' : '0'
      el.style.width = (Math.random() * 8 + 4) + 'px'
      el.style.height = (Math.random() * 8 + 4) + 'px'
      el.style.animationDelay = (Math.random() * 1.5) + 's'
      el.style.animationDuration = (Math.random() * 2 + 2) + 's'
      document.body.appendChild(el)
      pieces.push(el)
    }

    const cleanup = setTimeout(() => {
      pieces.forEach(p => p.remove())
    }, 5000)

    return () => {
      clearTimeout(cleanup)
      pieces.forEach(p => p.remove())
    }
  }, [])

  return <div ref={containerRef} />
})

export default Confetti
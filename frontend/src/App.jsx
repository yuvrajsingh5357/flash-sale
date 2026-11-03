import { useState, useCallback, useRef, useId } from 'react'
import { Zap, ShoppingBag, Loader2, CheckCircle2, XCircle, Package, Users } from 'lucide-react'
import CountdownTimer from './components/CountdownTimer'
import Toast from './components/Toast'
import Confetti from './components/Confetti'
import { useOrderPolling } from './hooks/useOrderPolling'

import AdminDashboard from './components/AdminDashboard'

const BASE_URL = 'http://localhost:8080'
const PRODUCT_ID = 2

// Sale starts 30 seconds from now by default (easy to demo)
const SALE_START = Date.now() + 3_000

// UI states
const STATE = {
  COUNTDOWN: 'COUNTDOWN',
  LIVE: 'LIVE',
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  SOLD_OUT: 'SOLD_OUT',
  FAILED: 'FAILED',
}

function App() {
  const [uiState, setUiState] = useState(STATE.COUNTDOWN)
  const [userId, setUserId] = useState(42)
  const [orderId, setOrderId] = useState(null)
  const [toasts, setToasts] = useState([])
  const [isAdminMode, setIsAdminMode] = useState(false)
  const toastCounter = useRef(0)
  const { startPolling } = useOrderPolling()

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = ++toastCounter.current
    setToasts(t => [...t, { id, message, type, duration }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const handleSaleStart = useCallback(() => {
    setUiState(STATE.LIVE)
  }, [])

  const handleBuy = useCallback(async () => {
    if (uiState !== STATE.LIVE) return

    // Optimistic UI — disable immediately before request
    setUiState(STATE.PENDING)

    try {
      const res = await fetch(`${BASE_URL}/orders/place`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({ userId: Number(userId), productId: PRODUCT_ID, quantity: 1 }),
      })

      const data = await res.json()

      if (res.status === 202 || res.status === 200 || data.status === 'RESERVED' || data.status === 'PENDING') {
        setOrderId(data.orderId)
        addToast('Order registered! Confirming with server...', 'cart', 4000)

        startPolling(
          data.orderId,
          (finalStatus) => {
            if (finalStatus === 'RESERVED' || finalStatus === 'SUCCESS') {
              setUiState(STATE.SUCCESS)
              addToast('🎉 Order reserved! You got it!', 'success', 8000)
            } else {
              setUiState(STATE.FAILED)
              addToast('Order could not be completed. Try again.', 'error')
            }
          },
          () => {
            setUiState(STATE.FAILED)
            addToast('Connection lost while checking your order.', 'error')
          }
        )
      } else if (res.status === 409 || data.status === 'SOLD_OUT') {
        setUiState(STATE.SOLD_OUT)
        addToast('Sold out! Better luck next drop.', 'warning', 0)
      } else if (res.status === 429 || data.status === 'RATE_LIMITED') {
        setUiState(STATE.LIVE) // Back to live so they can try again
        addToast('Too many requests. Please slow down.', 'warning')
      } else {
        setUiState(STATE.LIVE)
        addToast('Something went wrong. Try again.', 'error')
      }
    } catch {
      setUiState(STATE.LIVE)
      addToast('Could not reach the server. Check your connection.', 'error')
    }
  }, [uiState, userId, addToast, startPolling])

  const isLive = uiState === STATE.LIVE
  const isPending = uiState === STATE.PENDING
  const isSuccess = uiState === STATE.SUCCESS
  const isSoldOut = uiState === STATE.SOLD_OUT
  const isFailed = uiState === STATE.FAILED
  const isCountdown = uiState === STATE.COUNTDOWN

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)' }}>
      {/* Ambient gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% -10%, rgba(255,60,0,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Header */}
      <header
        className="relative z-10 flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'var(--fire)' }}>
            <Zap size={14} fill="white" color="white" />
          </div>
          <span className="font-display text-xl tracking-wider" style={{ color: 'var(--text)' }}>
            FLASHDROP
          </span>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsAdminMode(true)}
            className="font-mono text-xs hover:text-white transition-colors" 
            style={{ color: 'var(--text-muted)' }}
          >
            ADMIN
          </button>
          
          <div className="flex items-center gap-2">
            <Users size={14} style={{ color: 'var(--text-muted)' }} />
            <span className="font-mono text-xs hidden sm:inline" style={{ color: 'var(--text-muted)' }}>USER ID</span>
            <input
              type="number"
              min={1}
              max={100}
              value={userId}
              onChange={e => setUserId(Math.min(100, Math.max(1, Number(e.target.value))))}
              className="font-mono text-sm text-center w-14 rounded px-2 py-1 outline-none"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>
        </div>
      </header>

      {isAdminMode ? (
        <AdminDashboard onClose={() => setIsAdminMode(false)} />
      ) : (
        <main className="relative z-10 max-w-2xl mx-auto px-6 py-12 sm:py-20">

        {/* Live badge */}
        {isLive && (
          <div className="flex justify-center mb-8 animate-slide-up">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full" style={{ background: 'rgba(255,60,0,0.1)', border: '1px solid rgba(255,60,0,0.4)' }}>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-fast" />
              <span className="font-mono text-xs tracking-widest uppercase" style={{ color: 'var(--fire)' }}>
                LIVE NOW
              </span>
            </div>
          </div>
        )}

        {/* Product Card */}
        <div
          className="rounded-2xl overflow-hidden mb-8"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {/* Product image placeholder — diagonal stripe "hype" design */}
          <div
            className="relative h-56 sm:h-72 flex items-center justify-center overflow-hidden"
            style={{ background: '#0D0D0D' }}
          >
            {/* Stripe accent */}
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: 'repeating-linear-gradient(-45deg, #FF3C00, #FF3C00 1px, transparent 1px, transparent 40px)',
              }}
            />
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background: 'radial-gradient(circle at 50% 120%, rgba(255,60,0,0.6) 0%, transparent 60%)',
              }}
            />
            <div className="relative flex flex-col items-center gap-3">
              <Package size={56} style={{ color: 'var(--fire)', opacity: 0.8 }} strokeWidth={1} />
              <span className="font-mono text-xs tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
                Product Image
              </span>
            </div>

            {/* Status overlays */}
            {isSuccess && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,20,10,0.85)' }}>
                <div className="flex flex-col items-center gap-3 animate-slide-up">
                  <CheckCircle2 size={56} style={{ color: '#00FF88' }} strokeWidth={1.5} />
                  <span className="font-display text-2xl tracking-wider" style={{ color: '#00FF88' }}>ORDER CONFIRMED</span>
                </div>
              </div>
            )}
            {(isSoldOut || isFailed) && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(20,0,0,0.85)' }}>
                <div className="flex flex-col items-center gap-3 animate-slide-up">
                  <XCircle size={56} style={{ color: 'var(--fire)' }} strokeWidth={1.5} />
                  <span className="font-display text-2xl tracking-wider" style={{ color: 'var(--fire)' }}>
                    {isSoldOut ? 'SOLD OUT' : 'ORDER FAILED'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="font-mono text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--fire)' }}>
                  LIMITED DROP — PRODUCT #{PRODUCT_ID}
                </p>
                <h1 className="font-display text-3xl sm:text-5xl tracking-wide leading-none" style={{ color: 'var(--text)' }}>
                  FLASH EDITION
                </h1>
                <p className="font-body text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Ultra-limited quantity. One per customer. First come, first served — no exceptions.
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-display text-3xl sm:text-4xl" style={{ color: 'var(--text)' }}>$299</p>
                <p className="font-mono text-xs line-through" style={{ color: 'var(--text-muted)' }}>$499</p>
              </div>
            </div>

            {/* Divider */}
            <div className="w-full h-px mb-6" style={{ background: 'var(--border)' }} />

            {/* Action area */}
            <div className="flex flex-col items-center gap-6">

              {/* Countdown Timer (isolated — does not re-render parent) */}
              {isCountdown && (
                <CountdownTimer saleStartsAt={SALE_START} onSaleStart={handleSaleStart} />
              )}

              {/* Order ID receipt for success */}
              {isSuccess && orderId && (
                <div className="w-full rounded-lg px-4 py-3 animate-slide-up" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)' }}>
                  <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>ORDER ID</p>
                  <p className="font-mono text-sm mt-0.5 break-all" style={{ color: '#00FF88' }}>{orderId}</p>
                </div>
              )}

              {/* Pending status */}
              {isPending && (
                <div className="flex items-center gap-2 animate-slide-up">
                  <Loader2 size={16} className="animate-spin" style={{ color: 'var(--fire)' }} />
                  <span className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
                    Confirming your order...
                  </span>
                </div>
              )}

              {/* Buy Button */}
              <button
                onClick={handleBuy}
                disabled={!isLive && !isPending}
                className="btn-fire w-full rounded-xl py-4 font-display text-2xl tracking-widest text-white flex items-center justify-center gap-3"
                style={isLive ? { animation: 'glowPulse 2s ease-in-out infinite' } : {}}
              >
                {isPending ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    PROCESSING
                  </>
                ) : isCountdown ? (
                  <>
                    <ShoppingBag size={20} />
                    SALE NOT STARTED
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 size={20} />
                    ORDER PLACED
                  </>
                ) : isSoldOut ? (
                  'SOLD OUT'
                ) : isFailed ? (
                  'ORDER FAILED'
                ) : (
                  <>
                    <Zap size={20} fill="white" />
                    BUY NOW
                  </>
                )}
              </button>

              {isCountdown && (
                <p className="font-mono text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  Get ready — button activates when the sale drops
                </p>
              )}

              {isLive && (
                <p className="font-mono text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  User ID {userId} · Limit 1 per account · Final sale
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
          Change User ID (1–100) in the header to simulate different accounts & rate limiting
        </p>
      </main>
      )}

      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            duration={t.duration}
            onClose={() => removeToast(t.id)}
          />
        ))}
      </div>

      {/* Confetti on success */}
      {isSuccess && <Confetti />}
    </div>
  )
}

export default App
import { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, ShoppingBag, Loader2, CheckCircle2, XCircle, Package, Users, Shield, Clock, AlertTriangle, ArrowRight, User, LogOut, RotateCcw } from 'lucide-react';
import CountdownTimer from './components/CountdownTimer';
import Toast from './components/Toast';
import Confetti from './components/Confetti';
import AdminDashboard from './components/AdminDashboard';

const ORDER_API = 'http://localhost:8080';
const CORE_API = 'http://localhost:8082';

export default function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('fs_token') || '');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('fs_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');

  // Storefront & Sales state
  const [sales, setSales] = useState([]);
  const [activeSale, setActiveSale] = useState(null);
  const [serverOffset, setServerOffset] = useState(0); // diff = server - client
  const [loadingSales, setLoadingSales] = useState(true);

  // Active Reservation / Checkout state (C4, C5, C6)
  const [reserving, setReserving] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null); // { orderId, saleId, totalAmount, reservedUntil, status }
  const [reservationTimeLeft, setReservationTimeLeft] = useState(null);
  const [shippingAddress, setShippingAddress] = useState('Flat 402, Highrise Tower, Bangalore, KA - 560001');
  const [paying, setPaying] = useState(false);
  const [simulateFail, setSimulateFail] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);

  // User Orders View (C8)
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [userOrders, setUserOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Admin Dashboard View (A1-A7)
  const [adminOpen, setAdminOpen] = useState(false);

  // Notifications
  const [toasts, setToasts] = useState([]);
  const toastCounter = useRef(0);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = ++toastCounter.current;
    setToasts(t => [...t, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  // 1. Fetch Server Time (C3) & Calculate Drift
  const syncServerTime = async () => {
    try {
      const res = await fetch(`${CORE_API}/api/v1/time`);
      if (res.ok) {
        const data = await res.json();
        const offset = data.serverTime - Date.now();
        setServerOffset(offset);
      }
    } catch {
      // fallback to 0
    }
  };

  // 2. Fetch Public Sales (C1)
  const loadPublicSales = async () => {
    try {
      const res = await fetch(`${CORE_API}/api/v1/sales/public`);
      if (res.ok) {
        const data = await res.json();
        setSales(data);
        if (data.length > 0 && !activeSale) {
          // Select live sale if any, otherwise first upcoming
          const live = data.find(s => s.status === 'LIVE');
          setActiveSale(live || data[0]);
        } else if (activeSale) {
          const updated = data.find(s => s.id === activeSale.id);
          if (updated) setActiveSale(updated);
        }
      }
    } catch (e) {
      console.warn('Could not fetch sales:', e);
    } finally {
      setLoadingSales(false);
    }
  };

  useEffect(() => {
    syncServerTime();
    loadPublicSales();
    const interval = setInterval(() => {
      loadPublicSales();
    }, 4000); // Polling sales & inventory
    return () => clearInterval(interval);
  }, []);

  // 3. 5-Minute Checkout Countdown Timer (C5)
  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'RESERVED') {
      setReservationTimeLeft(null);
      return;
    }

    const expiryTime = new Date(activeOrder.reservedUntil).getTime();

    const interval = setInterval(() => {
      const remainingMs = expiryTime - (Date.now() + serverOffset);
      if (remainingMs <= 0) {
        setReservationTimeLeft(0);
        clearInterval(interval);
        addToast('Your 5-minute reservation window has expired! Stock has been released.', 'warning', 7000);
        setActiveOrder(prev => prev ? { ...prev, status: 'EXPIRED' } : null);
      } else {
        setReservationTimeLeft(Math.floor(remainingMs / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeOrder, serverOffset, addToast]);

  // Auth Operations (C2)
  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = authMode === 'signup' ? '/api/v1/auth/signup' : '/api/v1/auth/login';
    const payload = authMode === 'signup'
      ? { email: authEmail, password: authPassword, fullName: authName }
      : { email: authEmail, password: authPassword };

    try {
      const res = await fetch(`${CORE_API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setToken(data.accessToken);
        setUser(data.user);
        localStorage.setItem('fs_token', data.accessToken);
        localStorage.setItem('fs_user', JSON.stringify(data.user));
        setAuthModalOpen(false);
        addToast(`Welcome ${data.user.fullName || data.user.email}!`, 'success');
      } else {
        addToast(data.message || 'Authentication failed', 'error');
      }
    } catch {
      addToast('Could not reach Core Service', 'error');
    }
  };

  const demoLogin = async (role) => {
    const creds = role === 'admin'
      ? { email: 'admin@flashsale.com', password: 'admin123' }
      : { email: 'shopper@flashsale.com', password: 'shopper123' };

    try {
      const res = await fetch(`${CORE_API}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds)
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.accessToken);
        setUser(data.user);
        localStorage.setItem('fs_token', data.accessToken);
        localStorage.setItem('fs_user', JSON.stringify(data.user));
        setAuthModalOpen(false);
        addToast(`Logged in as ${role.toUpperCase()} (${data.user.email})`, 'success');
      } else {
        addToast(data.message || 'Demo login failed', 'error');
      }
    } catch {
      addToast('Connection failed', 'error');
    }
  };

  const logout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('fs_token');
    localStorage.removeItem('fs_user');
    addToast('Logged out successfully', 'info');
  };

  // 4. Reserve Flow (C4 Hot Path)
  const handleReserve = async () => {
    if (!token) {
      setAuthModalOpen(true);
      addToast('Please login to reserve flash sale items', 'info');
      return;
    }
    if (!activeSale || activeSale.status !== 'LIVE') {
      addToast('Sale is not live yet!', 'warning');
      return;
    }

    setReserving(true);
    setOrderConfirmed(false);

    try {
      const res = await fetch(`${ORDER_API}/orders/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          saleId: activeSale.id,
          productId: activeSale.productId,
          quantity: 1
        })
      });

      const data = await res.json();

      if (res.status === 202 || data.status === 'RESERVED') {
        setActiveOrder({
          orderId: data.orderId,
          saleId: activeSale.id,
          productName: activeSale.productName,
          totalAmount: activeSale.salePrice,
          reservedUntil: data.reservedUntil || new Date(Date.now() + 300000).toISOString(),
          status: 'RESERVED'
        });
        addToast('Item reserved! Complete payment within 5 minutes.', 'success', 6000);
        loadPublicSales();
      } else if (res.status === 409 || data.status === 'SOLD_OUT') {
        addToast('Sold Out! All allocated items have been claimed.', 'warning', 5000);
      } else if (res.status === 400 && data.status === 'LIMIT_REACHED') {
        addToast('Limit reached: You have already reserved the maximum allowed for this sale.', 'warning', 6000);
      } else if (res.status === 429 || data.status === 'RATE_LIMITED') {
        addToast('Too many requests! Please slow down and try again.', 'warning', 4000);
      } else {
        addToast(data.message || 'Could not reserve item', 'error');
      }
    } catch {
      addToast('Failed to reach Order Service (port 8080)', 'error');
    } finally {
      setReserving(false);
    }
  };

  // 5. Mock Payment Flow (C6, C10)
  const handlePay = async () => {
    if (!activeOrder) return;
    setPaying(true);

    try {
      const res = await fetch(`${CORE_API}/api/v1/payments/mock-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId: activeOrder.orderId,
          shouldSucceed: !simulateFail,
          failureReason: simulateFail ? 'Simulated Bank Payment Gateway Timeout' : null
        })
      });

      const data = await res.json();

      if (res.ok && data.status === 'SUCCESS') {
        setActiveOrder(prev => ({ ...prev, status: 'PAID' }));
        setOrderConfirmed(true);
        addToast('Payment Confirmed! Your order is placed.', 'success', 8000);
        loadPublicSales();
      } else {
        addToast(`Payment failed: ${data.errorMessage || 'Transaction declined'}. You can retry before your reservation expires!`, 'error', 6000);
      }
    } catch {
      addToast('Network error processing payment', 'error');
    } finally {
      setPaying(false);
    }
  };

  // 6. Cancel Reservation (C9)
  const handleCancelReservation = async (orderIdToCancel) => {
    const id = orderIdToCancel || activeOrder?.orderId;
    if (!id) return;

    try {
      const res = await fetch(`${CORE_API}/api/v1/user/orders/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        addToast('Reservation cancelled. Stock restored for others.', 'info');
        if (activeOrder && activeOrder.orderId === id) {
          setActiveOrder(null);
        }
        loadPublicSales();
        if (ordersModalOpen) loadUserOrders();
      } else {
        const err = await res.json();
        addToast(err.message || 'Failed to cancel reservation', 'error');
      }
    } catch {
      addToast('Failed to connect to cancel order', 'error');
    }
  };

  // 7. My Orders List (C8)
  const loadUserOrders = async () => {
    if (!token) return;
    setLoadingOrders(true);
    try {
      const res = await fetch(`${CORE_API}/api/v1/user/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setUserOrders(await res.json());
      }
    } catch {
      addToast('Could not fetch orders', 'error');
    } finally {
      setLoadingOrders(false);
    }
  };

  const openOrdersModal = () => {
    setOrdersModalOpen(true);
    loadUserOrders();
  };

  return (
    <div className="min-h-screen bg-[#0a0b10] text-[#f0ede8] flex flex-col font-sans selection:bg-[#ff3c00] selection:text-white">
      {orderConfirmed && <Confetti />}

      {/* Navigation Header */}
      <header className="border-b border-[#1f2232] bg-[#0f1118]/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff3c00] to-amber-500 flex items-center justify-center shadow-lg shadow-[#ff3c00]/20">
            <Zap size={20} className="text-white fill-white" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-lg sm:text-xl tracking-tight text-white flex items-center gap-2">
              FLASH<span className="text-[#ff3c00]">DROP</span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#ff3c00]/10 text-[#ff3c00] border border-[#ff3c00]/20">
                Single-Merchant
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={openOrdersModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1c28] hover:bg-[#252839] border border-[#2c3044] text-xs font-medium text-gray-300 transition-colors"
              >
                <ShoppingBag size={14} className="text-amber-400" />
                <span className="hidden sm:inline">My Orders (C8)</span>
              </button>

              {user.role === 'ROLE_ADMIN' && (
                <button
                  onClick={() => setAdminOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-semibold text-amber-400 transition-colors"
                >
                  <Shield size={14} />
                  <span>Admin Hub (A1-A7)</span>
                </button>
              )}

              <div className="flex items-center gap-2 pl-2 border-l border-[#222536]">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-white">{user.fullName || user.email}</div>
                  <div className="text-[10px] text-gray-400 font-mono">{user.role}</div>
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg bg-[#1a1c28] hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }}
                className="px-4 py-1.5 rounded-lg bg-[#1a1c28] hover:bg-[#252839] border border-[#2c3044] text-xs font-semibold text-gray-200 transition-colors"
              >
                Sign In (C2)
              </button>
              <button
                onClick={() => { setAuthMode('signup'); setAuthModalOpen(true); }}
                className="px-4 py-1.5 rounded-lg bg-[#ff3c00] hover:bg-[#e03500] text-white text-xs font-semibold shadow-lg shadow-[#ff3c00]/20 transition-all"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-8">

        {/* Hero & Featured Sale Drop */}
        {activeSale ? (
          <section className="bg-gradient-to-b from-[#141622] to-[#0f1118] border border-[#232738] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
            
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff3c00]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              
              {/* Left Column: Product Image & Badges */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div className="relative group w-full max-w-md aspect-square rounded-2xl overflow-hidden border border-[#282c40] bg-[#10121a]">
                  <img
                    src={activeSale.productImageUrl || "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=80"}
                    alt={activeSale.productName}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-md ${
                      activeSale.status === 'LIVE' ? 'bg-[#ff3c00] text-white' :
                      activeSale.status === 'SCHEDULED' ? 'bg-cyan-500 text-black' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      {activeSale.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Title, Timer, Pricing, 1-Click Action */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <div className="text-xs font-mono text-[#ff3c00] uppercase tracking-widest font-semibold flex items-center gap-1 mb-2">
                    <Zap size={14} className="fill-[#ff3c00]" />
                    Featured Flash Sale Event
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-white tracking-tight leading-tight">
                    {activeSale.title}
                  </h2>
                  <p className="text-sm text-gray-400 mt-2 line-clamp-3">
                    {activeSale.productDescription}
                  </p>
                </div>

                {/* Countdown Timer or Live Indicator (C3) */}
                {activeSale.status === 'SCHEDULED' ? (
                  <div className="p-4 bg-[#181b28] border border-[#282d42] rounded-2xl">
                    <CountdownTimer
                      saleStartsAt={new Date(activeSale.startTime).getTime()}
                      serverOffset={serverOffset}
                      onSaleStart={() => {
                        loadPublicSales();
                        addToast('Flash sale is now LIVE!', 'success');
                      }}
                    />
                  </div>
                ) : activeSale.status === 'LIVE' ? (
                  <div className="flex flex-col sm:flex-row gap-4 p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl">
                    <div className="flex-1">
                      <div className="text-xs font-mono text-emerald-400 font-semibold uppercase flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                        Sale Live Now
                      </div>
                      <div className="text-sm text-gray-300 mt-1">
                        Stock decrementing atomically in Redis hot path.
                      </div>
                    </div>
                    <div className="text-right sm:border-l sm:border-emerald-500/20 sm:pl-4">
                      <div className="text-[10px] text-gray-400 uppercase font-mono">Stock Remaining</div>
                      <div className="text-2xl font-bold font-mono text-emerald-400">
                        {activeSale.remainingStock} <span className="text-xs text-gray-400">/ {activeSale.stockAllocation}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-800/40 border border-gray-700 rounded-2xl text-center text-gray-400 text-sm">
                    This flash sale drop has ended.
                  </div>
                )}

                {/* Price Display */}
                <div className="flex items-baseline gap-4 pt-2">
                  <span className="font-display text-4xl sm:text-5xl font-extrabold text-white">
                    ₹{activeSale.salePrice}
                  </span>
                  {activeSale.originalPrice && (
                    <span className="text-lg text-gray-500 line-through">
                      ₹{activeSale.originalPrice}
                    </span>
                  )}
                  <span className="text-xs font-semibold px-2 py-1 rounded bg-[#ff3c00]/10 text-[#ff3c00] border border-[#ff3c00]/20 font-mono">
                    Limit {activeSale.perUserLimit} / user
                  </span>
                </div>

                {/* 1-Click Buy Action (C4) */}
                <div className="pt-2">
                  {activeOrder && activeOrder.status === 'RESERVED' ? (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-amber-400 uppercase flex items-center gap-1.5">
                          <Clock size={15} />
                          Active Reservation Pending
                        </div>
                        <div className="text-xs text-gray-300">
                          Expires in: <span className="font-mono font-bold text-white">{reservationTimeLeft}s</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {}}
                        className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold rounded-xl shadow-lg transition-all"
                      >
                        Resume Checkout
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleReserve}
                      disabled={reserving || activeSale.status !== 'LIVE' || activeSale.remainingStock <= 0}
                      className={`w-full py-4 px-6 rounded-2xl font-display font-extrabold text-lg sm:text-xl flex items-center justify-center gap-3 shadow-xl transition-all ${
                        activeSale.status === 'LIVE' && activeSale.remainingStock > 0
                          ? 'bg-[#ff3c00] hover:bg-[#e03500] text-white hover:shadow-[#ff3c00]/30 hover:scale-[1.01] active:scale-[0.99]'
                          : 'bg-[#1e2130] text-gray-500 cursor-not-allowed border border-[#2a2f44]'
                      }`}
                    >
                      {reserving ? (
                        <>
                          <Loader2 size={24} className="animate-spin" />
                          <span>Securing Reservation in Redis...</span>
                        </>
                      ) : activeSale.status !== 'LIVE' ? (
                        <span>Sale Not Live Yet</span>
                      ) : activeSale.remainingStock <= 0 ? (
                        <span>Sold Out</span>
                      ) : (
                        <>
                          <Zap size={22} className="fill-white" />
                          <span>1-Click Buy Now (Reserve)</span>
                          <ArrowRight size={20} />
                        </>
                      )}
                    </button>
                  )}
                </div>

              </div>
            </div>
          </section>
        ) : (
          <div className="p-16 text-center text-gray-500 bg-[#12131a] rounded-3xl border border-[#232738]">
            <Loader2 size={32} className="animate-spin mx-auto mb-3 text-amber-500" />
            <p>Loading active flash sale drop...</p>
          </div>
        )}

        {/* ACTIVE CHECKOUT MODAL (C5, C6, C9) */}
        {activeOrder && activeOrder.status === 'RESERVED' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
            <div className="bg-[#141622] border border-[#282d42] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-gray-200">
              
              {/* Header with 5-minute timer */}
              <div className="p-5 border-b border-[#282d42] bg-[#191c2b] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Clock size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-white text-base">Reserved Item Checkout (C5)</h3>
                    <p className="text-xs text-gray-400">Order ID: #{activeOrder.orderId.slice(0, 8)}...</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block font-mono">TIME LEFT</span>
                  <span className="text-xl font-mono font-extrabold text-amber-400">
                    {Math.floor((reservationTimeLeft || 0) / 60)}:{String((reservationTimeLeft || 0) % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                
                {/* Order Summary */}
                <div className="p-4 bg-[#10121b] border border-[#202436] rounded-xl flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-white text-sm">{activeOrder.productName}</h4>
                    <span className="text-xs text-gray-400">Quantity: 1 unit</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xl font-extrabold text-white">₹{activeOrder.totalAmount}</span>
                  </div>
                </div>

                {/* Delivery Address */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1 font-semibold">Shipping Address</label>
                  <input
                    type="text"
                    value={shippingAddress}
                    onChange={e => setShippingAddress(e.target.value)}
                    className="w-full bg-[#181b28] border border-[#2b3046] rounded-xl px-3.5 py-2.5 text-xs text-white"
                  />
                </div>

                {/* Payment Simulation Toggle (C6, C10) */}
                <div className="p-3 bg-[#181b28] border border-[#2b3046] rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-white block">Mock Gateway Mode</span>
                    <span className="text-[11px] text-gray-400">Toggle to test payment failure & retry (C10)</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className={`text-[10px] font-mono font-bold ${simulateFail ? 'text-red-400' : 'text-emerald-400'}`}>
                      {simulateFail ? 'FAIL' : 'SUCCESS'}
                    </span>
                    <input
                      type="checkbox"
                      checked={simulateFail}
                      onChange={e => setSimulateFail(e.target.checked)}
                      className="toggle-checkbox"
                    />
                  </label>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handlePay}
                    disabled={paying || reservationTimeLeft <= 0}
                    className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-black font-display font-extrabold text-base rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    {paying ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Verifying Payment...</span>
                      </>
                    ) : (
                      <>
                        <span>Pay ₹{activeOrder.totalAmount} ({simulateFail ? 'Mock Fail' : 'Mock Success'})</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleCancelReservation()}
                    className="w-full py-2.5 px-4 bg-transparent hover:bg-red-500/10 text-red-400 text-xs font-semibold rounded-xl border border-red-500/20 transition-colors"
                  >
                    Cancel Reservation (C9) & Restore Stock
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ORDER SUCCESS MODAL (C7) */}
        {orderConfirmed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
            <div className="bg-[#141622] border border-emerald-500/40 rounded-3xl w-full max-w-md p-8 text-center space-y-5 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-2xl text-white">Order Confirmed!</h3>
                <p className="text-xs text-gray-400 mt-1">Payment processed and verified. Stock safely claimed.</p>
              </div>

              <div className="p-4 bg-[#10121b] border border-[#202436] rounded-xl text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="font-mono font-bold text-emerald-400">PAID</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Order ID:</span>
                  <span className="font-mono text-gray-300">#{activeOrder?.orderId.slice(0, 12)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Paid:</span>
                  <span className="font-mono font-bold text-white">₹{activeOrder?.totalAmount}</span>
                </div>
              </div>

              <button
                onClick={() => { setOrderConfirmed(false); setActiveOrder(null); openOrdersModal(); }}
                className="w-full py-3 bg-[#ff3c00] hover:bg-[#e03500] text-white font-bold text-sm rounded-xl"
              >
                View in My Orders (C8)
              </button>
            </div>
          </div>
        )}

        {/* MY ORDERS MODAL (C8) */}
        {ordersModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#12131a] border border-[#232738] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-gray-200">
              <div className="p-5 border-b border-[#232738] flex items-center justify-between bg-[#171924]">
                <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                  <ShoppingBag size={18} className="text-amber-400" />
                  My Orders (C8)
                </h3>
                <button onClick={() => setOrdersModalOpen(false)} className="text-gray-400 hover:text-white text-xs">
                  Close
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-3">
                {loadingOrders ? (
                  <div className="p-12 text-center text-gray-500">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                    Loading orders...
                  </div>
                ) : userOrders.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    No orders placed yet. Reserve a flash sale drop to see it here!
                  </div>
                ) : (
                  userOrders.map(order => (
                    <div key={order.id} className="p-4 bg-[#171924] border border-[#232738] rounded-xl flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-bold text-white text-sm">{order.productName}</div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          ID: #{order.id.slice(0, 8)}... • {new Date(order.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono font-bold text-white text-sm">₹{order.totalAmount}</div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            order.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            order.status === 'RESERVED' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            order.status === 'REFUNDED' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                            'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                          }`}>
                            {order.status}
                          </span>
                        </div>

                        {order.status === 'RESERVED' && (
                          <button
                            onClick={() => handleCancelReservation(order.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs"
                            title="Cancel Reservation (C9)"
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* AUTH MODAL (C2) */}
        {authModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#141622] border border-[#282d42] rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="font-display font-bold text-xl text-white">
                  {authMode === 'login' ? 'Shopper Sign In' : 'Create Shopper Account'}
                </h3>
                <button onClick={() => setAuthModalOpen(false)} className="text-gray-400 hover:text-white text-xs">
                  ✕
                </button>
              </div>

              {/* Demo 1-Click Buttons */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-[#10121a] rounded-xl border border-[#222536]">
                <button
                  type="button"
                  onClick={() => demoLogin('shopper')}
                  className="py-2 px-3 rounded-lg bg-[#1c1f2e] hover:bg-[#282c42] text-xs font-semibold text-amber-400 text-center transition-colors"
                >
                  ⚡ Demo Shopper
                </button>
                <button
                  type="button"
                  onClick={() => demoLogin('admin')}
                  className="py-2 px-3 rounded-lg bg-[#1c1f2e] hover:bg-[#282c42] text-xs font-semibold text-cyan-400 text-center transition-colors"
                >
                  🛡️ Demo Admin
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4 text-xs">
                {authMode === 'signup' && (
                  <div>
                    <label className="text-gray-400 block mb-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="Alex Shopper"
                      value={authName}
                      onChange={e => setAuthName(e.target.value)}
                      className="w-full bg-[#1b1e2c] border border-[#2b3046] rounded-xl px-3.5 py-2.5 text-white"
                    />
                  </div>
                )}
                <div>
                  <label className="text-gray-400 block mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    required
                    className="w-full bg-[#1b1e2c] border border-[#2b3046] rounded-xl px-3.5 py-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={e => setAuthPassword(e.target.value)}
                    required
                    className="w-full bg-[#1b1e2c] border border-[#2b3046] rounded-xl px-3.5 py-2.5 text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#ff3c00] hover:bg-[#e03500] text-white font-bold rounded-xl text-sm transition-all"
                >
                  {authMode === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              </form>

              <div className="text-center text-xs text-gray-400">
                {authMode === 'login' ? (
                  <>Don't have an account? <button onClick={() => setAuthMode('signup')} className="text-[#ff3c00] font-semibold hover:underline">Sign up</button></>
                ) : (
                  <>Already have an account? <button onClick={() => setAuthMode('login')} className="text-[#ff3c00] font-semibold hover:underline">Sign in</button></>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ADMIN DASHBOARD (A1-A7) */}
        {adminOpen && (
          <AdminDashboard
            user={user}
            token={token}
            onClose={() => setAdminOpen(false)}
            onRefreshStorefront={loadPublicSales}
          />
        )}

      </main>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Shield, Key, RefreshCw, Server, CheckCircle2, XCircle } from 'lucide-react';

const ORDER_API = 'http://localhost:8080';
const WORKER_API = 'http://localhost:8081';

export default function AdminDashboard({ onClose }) {
  const [adminKey, setAdminKey] = useState(localStorage.getItem('adminKey') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  const [reservations, setReservations] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const [productId, setProductId] = useState(2);
  const [stock, setStock] = useState(100);
  const [initStatus, setInitStatus] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${WORKER_API}/admin/reservations`, {
        headers: { 'X-ADMIN-KEY': adminKey }
      });
      if (res.ok) {
        setIsAuthenticated(true);
        localStorage.setItem('adminKey', adminKey);
        fetchData(adminKey);
      } else {
        setLoginError('Invalid Admin Key');
      }
    } catch (err) {
      setLoginError('Could not connect to Worker Service (Port 8081)');
    }
  };

  const fetchData = async (key = adminKey) => {
    setLoading(true);
    try {
      const [resReq, ordReq] = await Promise.all([
        fetch(`${WORKER_API}/admin/reservations`, { headers: { 'X-ADMIN-KEY': key } }),
        fetch(`${WORKER_API}/admin/orders`, { headers: { 'X-ADMIN-KEY': key } })
      ]);
      
      if (resReq.ok && ordReq.ok) {
        setReservations(await resReq.json());
        setOrders(await ordReq.json());
      } else if (resReq.status === 401 || ordReq.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminKey && !isAuthenticated) {
      // Auto-try if stored in localStorage
      fetch(`${WORKER_API}/admin/reservations`, { headers: { 'X-ADMIN-KEY': adminKey } })
        .then(res => {
          if (res.ok) {
            setIsAuthenticated(true);
            fetchData(adminKey);
          }
        }).catch(() => {});
    }
  }, []);

  const handleInitStock = async (e) => {
    e.preventDefault();
    setInitStatus('Loading...');
    try {
      const res = await fetch(`${ORDER_API}/admin/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, stock })
      });
      if (res.ok) {
        setInitStatus('Success! Stock Initialized.');
        setTimeout(() => setInitStatus(''), 3000);
      } else {
        setInitStatus('Failed to initialize.');
      }
    } catch (err) {
      setInitStatus('Network error.');
    }
  };

  const logout = () => {
    localStorage.removeItem('adminKey');
    setAdminKey('');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 rounded-2xl animate-slide-up" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <Shield size={24} style={{ color: 'var(--text)' }} />
          </div>
          <h2 className="font-display text-2xl">Admin Access</h2>
          <p className="text-sm font-mono text-center" style={{ color: 'var(--text-muted)' }}>
            Enter your secret key to access the flash sale engine dashboard.
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="relative">
            <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="password"
              placeholder="X-ADMIN-KEY"
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl outline-none font-mono text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          {loginError && <p className="text-red-500 text-sm font-mono text-center">{loginError}</p>}
          <button type="submit" className="py-3 rounded-xl font-mono text-sm tracking-widest text-black" style={{ background: 'var(--text)' }}>
            AUTHENTICATE
          </button>
        </form>

        <button onClick={onClose} className="w-full mt-4 py-3 font-mono text-xs tracking-widest text-center" style={{ color: 'var(--text-muted)' }}>
          RETURN TO STORE
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-8 p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-8 pb-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <Server size={24} style={{ color: '#00FF88' }} />
          <h1 className="font-display text-3xl">Control Panel</h1>
        </div>
        <div className="flex gap-4">
          <button onClick={() => fetchData()} className="flex items-center gap-2 px-4 py-2 rounded font-mono text-xs" style={{ background: 'var(--surface-2)' }}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> REFRESH
          </button>
          <button onClick={logout} className="px-4 py-2 rounded font-mono text-xs text-red-400" style={{ background: 'var(--surface-2)' }}>
            LOGOUT
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded font-mono text-xs" style={{ background: 'var(--text)', color: 'black' }}>
            EXIT
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-mono text-xs tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>INITIALIZE STOCK (PORT 8080)</h3>
          <form onSubmit={handleInitStock} className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input type="number" placeholder="Product ID" value={productId} onChange={e => setProductId(e.target.value)} className="w-1/2 p-2 rounded font-mono text-sm" style={{ background: 'var(--surface-2)', color: 'white' }} />
              <input type="number" placeholder="Stock" value={stock} onChange={e => setStock(e.target.value)} className="w-1/2 p-2 rounded font-mono text-sm" style={{ background: 'var(--surface-2)', color: 'white' }} />
            </div>
            <button type="submit" className="w-full py-2 rounded font-mono text-sm bg-white text-black">SET IN REDIS</button>
            {initStatus && <p className="font-mono text-xs text-center mt-2" style={{ color: '#00FF88' }}>{initStatus}</p>}
          </form>
        </div>

        <div className="p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-mono text-xs tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>ACTIVE RESERVATIONS</h3>
          <p className="font-display text-5xl" style={{ color: 'var(--fire)' }}>{reservations.length}</p>
          <p className="font-mono text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Awaiting expiration or payment</p>
        </div>

        <div className="p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-mono text-xs tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>TOTAL ORDERS</h3>
          <p className="font-display text-5xl">{orders.length}</p>
          <p className="font-mono text-xs mt-2" style={{ color: 'var(--text-muted)' }}>All time historical</p>
        </div>
      </div>

      <div className="p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="font-mono text-xs tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>RECENT ORDERS (DB / PORT 8081)</h3>
        {orders.length === 0 ? (
          <p className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>No orders in database yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-sm border-collapse">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="pb-3 border-b border-gray-800">Order ID</th>
                  <th className="pb-3 border-b border-gray-800">User ID</th>
                  <th className="pb-3 border-b border-gray-800">Status</th>
                  <th className="pb-3 border-b border-gray-800">Reserved Until</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice().reverse().slice(0, 10).map(o => (
                  <tr key={o.id}>
                    <td className="py-3 border-b border-gray-800 truncate max-w-[150px]" title={o.id}>{o.id}</td>
                    <td className="py-3 border-b border-gray-800">{o.userId}</td>
                    <td className="py-3 border-b border-gray-800">
                      <span className={`px-2 py-1 rounded text-xs ${o.status === 'RESERVED' ? 'bg-orange-900/30 text-orange-400' : o.status === 'EXPIRED' ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3 border-b border-gray-800 text-xs text-gray-500">
                      {o.reservedUntil ? new Date(o.reservedUntil).toLocaleTimeString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

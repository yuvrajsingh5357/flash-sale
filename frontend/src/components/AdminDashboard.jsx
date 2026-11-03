import { useState, useEffect } from 'react';
import { Shield, Package, Calendar, RefreshCw, AlertTriangle, CheckCircle, RotateCcw, ListFilter, Activity, DollarSign } from 'lucide-react';

const CORE_API = 'http://localhost:8082';

export default function AdminDashboard({ user, token, onClose, onRefreshStorefront }) {
  const [activeTab, setActiveTab] = useState('sales'); // 'sales', 'products', 'orders', 'audit'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [orders, setOrders] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedSaleMetrics, setSelectedSaleMetrics] = useState(null);

  // Forms
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', imageUrl: '' });
  const [newSale, setNewSale] = useState({
    productId: '',
    title: '',
    startTime: '',
    endTime: '',
    salePrice: '',
    stockAllocation: 100,
    perUserLimit: 1
  });

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [prodRes, salesRes, ordersRes, auditRes] = await Promise.all([
        fetch(`${CORE_API}/api/v1/products`, { headers: authHeaders }),
        fetch(`${CORE_API}/api/v1/admin/sales`, { headers: authHeaders }),
        fetch(`${CORE_API}/api/v1/admin/orders`, { headers: authHeaders }),
        fetch(`${CORE_API}/api/v1/admin/audit-logs`, { headers: authHeaders })
      ]);

      if (prodRes.ok) setProducts(await prodRes.json());
      if (salesRes.ok) {
        const sData = await salesRes.json();
        setSales(sData);
        if (sData.length > 0) {
          fetchMetrics(sData[0].id);
        }
      }
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());
    } catch (err) {
      setError('Failed to connect to Core Service (port 8082)');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async (saleId) => {
    try {
      const res = await fetch(`${CORE_API}/api/v1/admin/sales/${saleId}/metrics`, { headers: authHeaders });
      if (res.ok) setSelectedSaleMetrics(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${CORE_API}/api/v1/admin/products`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: newProduct.name,
          description: newProduct.description,
          price: parseFloat(newProduct.price),
          imageUrl: newProduct.imageUrl
        })
      });
      if (res.ok) {
        setSuccess('Product created successfully!');
        setNewProduct({ name: '', description: '', price: '', imageUrl: '' });
        loadData();
      } else {
        const err = await res.json();
        setError(err.message || 'Failed to create product');
      }
    } catch (e) {
      setError('Network error');
    }
  };

  const handleCreateSale = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${CORE_API}/api/v1/admin/sales`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          productId: parseInt(newSale.productId),
          title: newSale.title,
          startTime: new Date(newSale.startTime).toISOString(),
          endTime: new Date(newSale.endTime).toISOString(),
          salePrice: parseFloat(newSale.salePrice),
          stockAllocation: parseInt(newSale.stockAllocation),
          perUserLimit: parseInt(newSale.perUserLimit)
        })
      });
      if (res.ok) {
        setSuccess('Flash sale scheduled successfully!');
        setNewSale({ productId: '', title: '', startTime: '', endTime: '', salePrice: '', stockAllocation: 100, perUserLimit: 1 });
        loadData();
        onRefreshStorefront?.();
      } else {
        const err = await res.json();
        setError(err.message || 'Failed to schedule sale');
      }
    } catch (e) {
      setError('Network error');
    }
  };

  const handleStatusChange = async (saleId, newStatus) => {
    try {
      const res = await fetch(`${CORE_API}/api/v1/admin/sales/${saleId}/status`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setSuccess(`Sale updated to ${newStatus}`);
        loadData();
        onRefreshStorefront?.();
      }
    } catch (e) {
      setError('Failed to update sale status');
    }
  };

  const handleRefund = async (orderId) => {
    if (!window.confirm(`Initiate refund for order ${orderId}?`)) return;
    try {
      const res = await fetch(`${CORE_API}/api/v1/admin/orders/${orderId}/refund`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ reason: 'Admin dashboard refund' })
      });
      if (res.ok) {
        setSuccess(`Order ${orderId.slice(0, 8)}... refunded successfully!`);
        loadData();
      } else {
        const err = await res.json();
        setError(err.message || 'Refund failed');
      }
    } catch (e) {
      setError('Network error initiating refund');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#12131a] border border-[#232738] rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-gray-200">
        
        {/* Header */}
        <div className="p-5 border-b border-[#232738] flex items-center justify-between bg-[#171924]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
              <Shield size={22} />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Merchant Operations Hub
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                  {user?.role}
                </span>
              </h2>
              <p className="text-xs text-gray-400">Single-Merchant Flash Sale Engine Administration</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-lg bg-[#232738] hover:bg-[#2d3248] text-gray-300 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-[#232738] px-6 bg-[#141620]">
          {[
            { id: 'sales', label: 'Flash Sales & Metrics', icon: Calendar },
            { id: 'products', label: 'Catalog / Products', icon: Package },
            { id: 'orders', label: 'Orders & Refunds', icon: ListFilter },
            { id: 'audit', label: 'Audit Trail', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setError(''); setSuccess(''); }}
                className={`flex items-center gap-2 px-5 py-3.5 border-b-2 text-xs font-medium transition-all ${
                  active
                    ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB: SALES */}
          {activeTab === 'sales' && (
            <div className="space-y-6">
              
              {/* Metrics Header if sale selected */}
              {selectedSaleMetrics && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-[#181a26] border border-[#272b3e] rounded-xl">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Initial Stock</span>
                    <span className="text-xl font-bold text-white font-mono">{selectedSaleMetrics.initialStock}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">Remaining in Redis</span>
                    <span className="text-xl font-bold text-emerald-400 font-mono">{selectedSaleMetrics.remainingStock}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-400 uppercase tracking-wider block">Active Reserved</span>
                    <span className="text-xl font-bold text-amber-400 font-mono">{selectedSaleMetrics.reservedOrders}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-cyan-400 uppercase tracking-wider block">Paid / Confirmed</span>
                    <span className="text-xl font-bold text-cyan-400 font-mono">{selectedSaleMetrics.paidOrders}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-red-400 uppercase tracking-wider block">Expired / Cancelled</span>
                    <span className="text-xl font-bold text-red-400 font-mono">{selectedSaleMetrics.expiredOrders + selectedSaleMetrics.cancelledOrders}</span>
                  </div>
                </div>
              )}

              {/* Schedule New Sale Form */}
              <div className="bg-[#171924] border border-[#232738] p-5 rounded-xl">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar size={16} className="text-amber-400" />
                  Schedule a New Flash Sale (A3)
                </h3>
                <form onSubmit={handleCreateSale} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-gray-400 block mb-1">Target Product</label>
                    <select
                      value={newSale.productId}
                      onChange={e => setNewSale({ ...newSale, productId: e.target.value })}
                      required
                      className="w-full bg-[#1e2130] border border-[#2d3248] rounded-lg px-3 py-2 text-white"
                    >
                      <option value="">Select a product...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-1">Sale Event Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Midnight Lightning Drop"
                      value={newSale.title}
                      onChange={e => setNewSale({ ...newSale, title: e.target.value })}
                      required
                      className="w-full bg-[#1e2130] border border-[#2d3248] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-1">Sale Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="39999"
                      value={newSale.salePrice}
                      onChange={e => setNewSale({ ...newSale, salePrice: e.target.value })}
                      required
                      className="w-full bg-[#1e2130] border border-[#2d3248] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-1">Start Time</label>
                    <input
                      type="datetime-local"
                      value={newSale.startTime}
                      onChange={e => setNewSale({ ...newSale, startTime: e.target.value })}
                      required
                      className="w-full bg-[#1e2130] border border-[#2d3248] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-1">End Time</label>
                    <input
                      type="datetime-local"
                      value={newSale.endTime}
                      onChange={e => setNewSale({ ...newSale, endTime: e.target.value })}
                      required
                      className="w-full bg-[#1e2130] border border-[#2d3248] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-gray-400 block mb-1">Stock Allocation</label>
                      <input
                        type="number"
                        min="1"
                        value={newSale.stockAllocation}
                        onChange={e => setNewSale({ ...newSale, stockAllocation: e.target.value })}
                        required
                        className="w-full bg-[#1e2130] border border-[#2d3248] rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 block mb-1">Per-User Limit</label>
                      <input
                        type="number"
                        min="1"
                        value={newSale.perUserLimit}
                        onChange={e => setNewSale({ ...newSale, perUserLimit: e.target.value })}
                        required
                        className="w-full bg-[#1e2130] border border-[#2d3248] rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-3 flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors"
                    >
                      Schedule Flash Sale
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Sales Table */}
              <div className="bg-[#171924] border border-[#232738] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#232738] flex justify-between items-center">
                  <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">All Scheduled Sales (A4)</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#141620] text-gray-400 border-b border-[#232738]">
                      <tr>
                        <th className="p-3">ID</th>
                        <th className="p-3">Title / Product</th>
                        <th className="p-3">Price</th>
                        <th className="p-3">Stock Left</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Window</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232738]">
                      {sales.map(s => (
                        <tr key={s.id} className="hover:bg-[#1e2130] transition-colors">
                          <td className="p-3 font-mono text-gray-400">#{s.id}</td>
                          <td className="p-3 font-semibold text-white">
                            <div>{s.title}</div>
                            <div className="text-[10px] text-gray-400">{s.productName}</div>
                          </td>
                          <td className="p-3 text-emerald-400 font-mono">₹{s.salePrice}</td>
                          <td className="p-3 font-mono">
                            <span className="text-amber-400 font-bold">{s.remainingStock}</span> / {s.stockAllocation}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              s.status === 'LIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              s.status === 'SCHEDULED' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                              'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                            }`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="p-3 text-[10px] text-gray-400">
                            {new Date(s.startTime).toLocaleTimeString()} - {new Date(s.endTime).toLocaleTimeString()}
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <button
                              onClick={() => fetchMetrics(s.id)}
                              className="px-2 py-1 rounded bg-[#2b2f44] hover:bg-[#373c57] text-gray-300 text-[11px]"
                            >
                              Metrics
                            </button>
                            {s.status === 'SCHEDULED' && (
                              <button
                                onClick={() => handleStatusChange(s.id, 'LIVE')}
                                className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[11px] font-semibold"
                              >
                                Go Live
                              </button>
                            )}
                            {s.status === 'LIVE' && (
                              <button
                                onClick={() => handleStatusChange(s.id, 'ENDED')}
                                className="px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 text-[11px] font-semibold"
                              >
                                End Sale
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PRODUCTS */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <div className="bg-[#171924] border border-[#232738] p-5 rounded-xl">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Package size={16} className="text-amber-400" />
                  Create New Product (A2)
                </h3>
                <form onSubmit={handleCreateProduct} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-gray-400 block mb-1">Product Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sony PlayStation 5 Pro"
                      value={newProduct.name}
                      onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                      required
                      className="w-full bg-[#1e2130] border border-[#2d3248] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-1">Base Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="54999.00"
                      value={newProduct.price}
                      onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
                      required
                      className="w-full bg-[#1e2130] border border-[#2d3248] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-gray-400 block mb-1">Image URL</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={newProduct.imageUrl}
                      onChange={e => setNewProduct({ ...newProduct, imageUrl: e.target.value })}
                      className="w-full bg-[#1e2130] border border-[#2d3248] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-gray-400 block mb-1">Description</label>
                    <textarea
                      rows="2"
                      placeholder="Product specifications and details..."
                      value={newProduct.description}
                      onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                      className="w-full bg-[#1e2130] border border-[#2d3248] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg"
                    >
                      Save Product
                    </button>
                  </div>
                </form>
              </div>

              {/* Product Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {products.map(p => (
                  <div key={p.id} className="bg-[#171924] border border-[#232738] rounded-xl overflow-hidden p-4 flex flex-col justify-between">
                    <div>
                      {p.imageUrl && (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-32 object-cover rounded-lg mb-3" />
                      )}
                      <h4 className="font-bold text-white text-sm">{p.name}</h4>
                      <p className="text-xs text-gray-400 line-clamp-2 mt-1">{p.description}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-[#232738] flex justify-between items-center">
                      <span className="font-mono text-emerald-400 font-bold">₹{p.price}</span>
                      <span className="text-[10px] text-gray-500 font-mono">ID: #{p.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: ORDERS & REFUNDS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="bg-[#171924] border border-[#232738] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#232738] flex justify-between items-center">
                  <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">All Customer Orders & Refunds (A6)</h4>
                  <span className="text-xs text-gray-400 font-mono">Total Orders: {orders.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#141620] text-gray-400 border-b border-[#232738]">
                      <tr>
                        <th className="p-3">Order ID</th>
                        <th className="p-3">Product</th>
                        <th className="p-3">User</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Created</th>
                        <th className="p-3 text-right">Refund Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232738]">
                      {orders.map(o => (
                        <tr key={o.id} className="hover:bg-[#1e2130] transition-colors">
                          <td className="p-3 font-mono text-gray-400">{o.id.slice(0, 8)}...</td>
                          <td className="p-3 font-semibold text-white">{o.productName}</td>
                          <td className="p-3 text-gray-400 font-mono">User #{o.userId}</td>
                          <td className="p-3 font-mono text-emerald-400">₹{o.totalAmount}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              o.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              o.status === 'RESERVED' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                              o.status === 'REFUNDED' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                              'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                            }`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="p-3 text-[10px] text-gray-400">
                            {new Date(o.createdAt).toLocaleString()}
                          </td>
                          <td className="p-3 text-right">
                            {o.status === 'PAID' ? (
                              <button
                                onClick={() => handleRefund(o.id)}
                                className="px-3 py-1 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 text-[11px] font-semibold border border-purple-500/30"
                              >
                                Refund (A6)
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-500">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="bg-[#171924] border border-[#232738] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#232738]">
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">System & Admin Audit Logs (A7)</h4>
              </div>
              <div className="divide-y divide-[#232738] max-h-[500px] overflow-y-auto font-mono text-xs">
                {auditLogs.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No audit logs recorded yet.</div>
                ) : (
                  auditLogs.map(log => (
                    <div key={log.id} className="p-3.5 hover:bg-[#1a1c28] flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            {log.action}
                          </span>
                          <span className="text-gray-300 text-xs font-sans font-semibold">
                            {log.entityType} {log.entityId ? `#${log.entityId.slice(0, 8)}` : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-sans">{log.details}</p>
                      </div>
                      <div className="text-right text-[10px] text-gray-500">
                        <div>User: {log.userId ? `#${log.userId}` : 'SYSTEM'}</div>
                        <div>{new Date(log.createdAt).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

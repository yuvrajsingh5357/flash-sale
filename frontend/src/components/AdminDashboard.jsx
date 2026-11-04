import { useState, useEffect } from 'react';
import { Shield, Package, Calendar, RefreshCw, AlertTriangle, CheckCircle, RotateCcw, ListFilter, Activity, Download, Database, Play, CheckCircle2 } from 'lucide-react';

const CORE_API = 'http://localhost:8082';
const WORKER_API = 'http://localhost:8081';

export default function AdminDashboard({ user, token, onClose, onRefreshStorefront }) {
  const [activeTab, setActiveTab] = useState('sales'); // 'sales', 'products', 'orders', 'reconciliation', 'audit'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [orders, setOrders] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedSaleMetrics, setSelectedSaleMetrics] = useState(null);
  const [reconciliationReports, setReconciliationReports] = useState([]);
  const [dltMessages, setDltMessages] = useState([]);

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
      
      // Load reconciliation reports
      fetchReconciliationReports();
      fetchDltMessages();
    } catch {
      setError('Failed to connect to backend services');
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

  const fetchReconciliationReports = async () => {
    try {
      const res = await fetch(`${CORE_API}/api/v1/admin/reconciliation/report`, { headers: authHeaders });
      if (res.ok) setReconciliationReports(await res.json());
    } catch (e) {
      console.error('Failed to fetch reconciliation reports', e);
    }
  };

  const fetchDltMessages = async () => {
    try {
      const res = await fetch(`${WORKER_API}/admin/dlt`, {
        headers: { 'X-ADMIN-KEY': 'super-secret' }
      });
      if (res.ok) setDltMessages(await res.json());
    } catch (e) {
      console.error('Failed to fetch DLT messages from worker', e);
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
    } catch {
      setError('Network error');
    }
  };

  const handleScheduleSale = async (e) => {
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
        setSuccess('Sale scheduled successfully!');
        setNewSale({ productId: '', title: '', startTime: '', endTime: '', salePrice: '', stockAllocation: 100, perUserLimit: 1 });
        loadData();
        if (onRefreshStorefront) onRefreshStorefront();
      } else {
        const err = await res.json();
        setError(err.message || 'Failed to schedule sale');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleUpdateStatus = async (saleId, status) => {
    try {
      const res = await fetch(`${CORE_API}/api/v1/admin/sales/${saleId}/status`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setSuccess(`Sale status updated to ${status}`);
        loadData();
        if (onRefreshStorefront) onRefreshStorefront();
      }
    } catch {
      setError('Failed to update status');
    }
  };

  const handleRefund = async (orderId) => {
    if (!confirm('Are you sure you want to trigger a refund for this order?')) return;
    try {
      const res = await fetch(`${CORE_API}/api/v1/admin/orders/${orderId}/refund`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ reason: 'Admin dashboard refund' })
      });
      if (res.ok) {
        setSuccess('Refund processed successfully!');
        loadData();
      } else {
        const err = await res.json();
        setError(err.message || 'Refund failed');
      }
    } catch {
      setError('Refund request failed');
    }
  };

  const handleRebuildRedis = async (saleId) => {
    try {
      const res = await fetch(`${CORE_API}/api/v1/admin/sales/${saleId}/rebuild-redis`, {
        method: 'POST',
        headers: authHeaders
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Redis reconstructed for Sale #${saleId}! True stock restored: ${data.rebuiltStock}`);
        loadData();
      } else {
        setError(data.message || 'Failed to rebuild Redis');
      }
    } catch {
      setError('Failed to trigger Redis recovery');
    }
  };

  const handleReplayDlt = async () => {
    try {
      const res = await fetch(`${WORKER_API}/admin/dlt/replay`, {
        method: 'POST',
        headers: { 'X-ADMIN-KEY': 'super-secret' }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || 'Replayed DLT messages successfully!');
        fetchDltMessages();
      } else {
        setError('Failed to replay DLT');
      }
    } catch {
      setError('Failed to reach Worker Service (port 8081)');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0f1118] border border-[#232738] rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-[#232738] bg-[#141620] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Shield size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-white text-base">Merchant Operations Hub</h3>
                <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
                  ADMIN CONSOLE
                </span>
              </div>
              <p className="text-xs text-gray-400">Single-Merchant Flash Sale Engine (A1-A7, S1-S7)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-lg bg-[#1e2130] text-gray-400 hover:text-white border border-[#2d3248]"
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
        <div className="flex border-b border-[#232738] px-6 bg-[#141620] overflow-x-auto">
          {[
            { id: 'sales', label: 'Flash Sales & Metrics (A3-A5)', icon: Calendar },
            { id: 'products', label: 'Catalog / Products (A2)', icon: Package },
            { id: 'orders', label: 'Orders & Refunds (A6)', icon: ListFilter },
            { id: 'reconciliation', label: 'Reconciliation & Recovery (S5, S6, S7)', icon: Database },
            { id: 'audit', label: 'Audit Trail (A7)', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setError(''); setSuccess(''); }}
                className={`flex items-center gap-2 px-5 py-3.5 border-b-2 text-xs font-medium transition-all whitespace-nowrap ${
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
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-[#171924] border border-[#232738] p-4 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-mono">REDIS REMAINING STOCK</span>
                    <span className="text-xl font-mono font-extrabold text-amber-400">{selectedSaleMetrics.redisStock}</span>
                  </div>
                  <div className="bg-[#171924] border border-[#232738] p-4 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-mono">RESERVED ORDERS</span>
                    <span className="text-xl font-mono font-extrabold text-cyan-400">{selectedSaleMetrics.reservedCount}</span>
                  </div>
                  <div className="bg-[#171924] border border-[#232738] p-4 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-mono">PAID ORDERS</span>
                    <span className="text-xl font-mono font-extrabold text-emerald-400">{selectedSaleMetrics.paidCount}</span>
                  </div>
                  <div className="bg-[#171924] border border-[#232738] p-4 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-mono">EXPIRED ORDERS</span>
                    <span className="text-xl font-mono font-extrabold text-gray-400">{selectedSaleMetrics.expiredCount}</span>
                  </div>
                  <div className="bg-[#171924] border border-[#232738] p-4 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-mono">GROSS REVENUE</span>
                    <span className="text-xl font-mono font-extrabold text-white">₹{selectedSaleMetrics.revenue}</span>
                  </div>
                </div>
              )}

              {/* Schedule New Sale Form */}
              <div className="bg-[#171924] border border-[#232738] rounded-xl p-5">
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">Schedule New Flash Sale (A3)</h4>
                <form onSubmit={handleScheduleSale} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-gray-400 block mb-1">Select Product</label>
                    <select
                      value={newSale.productId}
                      onChange={e => setNewSale({ ...newSale, productId: e.target.value })}
                      required
                      className="w-full bg-[#1e2130] border border-[#2d3248] rounded-lg px-3 py-2 text-white"
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-1">Sale Event Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Midnight Cyber Drop #1"
                      value={newSale.title}
                      onChange={e => setNewSale({ ...newSale, title: e.target.value })}
                      required
                      className="w-full bg-[#1e2130] border border-[#2d3248] rounded-lg px-3 py-2 text-white"
                    >
                    </input>
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-1">Sale Flash Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 39999.00"
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
                      <label className="text-gray-400 block mb-1">Stock Alloc.</label>
                      <input
                        type="number"
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
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg"
                    >
                      Schedule Sale Event
                    </button>
                  </div>
                </form>
              </div>

              {/* Sales List Table */}
              <div className="bg-[#171924] border border-[#232738] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#232738] flex justify-between items-center">
                  <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Scheduled & Active Flash Sales</h4>
                  <span className="text-xs text-gray-400 font-mono">Total: {sales.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#141620] text-gray-400 border-b border-[#232738]">
                      <tr>
                        <th className="p-3">ID</th>
                        <th className="p-3">Title</th>
                        <th className="p-3">Product</th>
                        <th className="p-3">Price</th>
                        <th className="p-3">Allocation</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Window</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232738]">
                      {sales.map(s => (
                        <tr key={s.id} className="hover:bg-[#1e2130] transition-colors cursor-pointer" onClick={() => fetchMetrics(s.id)}>
                          <td className="p-3 font-mono text-gray-400">#{s.id}</td>
                          <td className="p-3 font-semibold text-white">{s.title}</td>
                          <td className="p-3 text-gray-300">{s.product?.name}</td>
                          <td className="p-3 font-mono text-emerald-400">₹{s.salePrice}</td>
                          <td className="p-3 font-mono text-amber-400">{s.stockAllocation}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              s.status === 'LIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              s.status === 'SCHEDULED' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                              s.status === 'ENDED' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30' :
                              'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="p-3 text-[10px] text-gray-400 font-mono">
                            {new Date(s.startTime).toLocaleTimeString()} - {new Date(s.endTime).toLocaleTimeString()}
                          </td>
                          <td className="p-3 text-right space-x-2">
                            {s.status === 'SCHEDULED' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(s.id, 'LIVE'); }}
                                className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-[10px] font-mono border border-emerald-500/30"
                              >
                                Force LIVE
                              </button>
                            )}
                            {s.status === 'LIVE' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(s.id, 'ENDED'); }}
                                className="px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[10px] font-mono border border-red-500/30"
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
              {/* Create Product Form */}
              <div className="bg-[#171924] border border-[#232738] rounded-xl p-5">
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">Add Product to Catalog (A2)</h4>
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
                  <div className="flex items-center gap-3">
                    <a
                      href={`${CORE_API}/api/v1/admin/orders/export`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Download size={14} /> Export CSV (A6)
                    </a>
                    <span className="text-xs text-gray-400 font-mono">Total Orders: {orders.length}</span>
                  </div>
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
                        <tr key={o.orderId || o.id} className="hover:bg-[#1e2130] transition-colors">
                          <td className="p-3 font-mono text-gray-400">{(o.orderId || o.id).slice(0, 8)}...</td>
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
                                onClick={() => handleRefund(o.orderId || o.id)}
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

          {/* TAB: RECONCILIATION & RECOVERY (S5, S6, S7) */}
          {activeTab === 'reconciliation' && (
            <div className="space-y-6">
              {/* S5 Reconciliation Table */}
              <div className="bg-[#171924] border border-[#232738] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#232738] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Database size={16} className="text-amber-400" />
                    <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Inventory Invariant Reconciliation (S5)
                    </h4>
                  </div>
                  <button
                    onClick={fetchReconciliationReports}
                    className="px-3 py-1 rounded bg-[#1e2130] text-gray-300 hover:text-white border border-[#2d3248] text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} /> Audit Invariants Now
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#141620] text-gray-400 border-b border-[#232738]">
                      <tr>
                        <th className="p-3">Sale ID</th>
                        <th className="p-3">Event Title</th>
                        <th className="p-3">Initial Stock</th>
                        <th className="p-3">Live Redis Stock</th>
                        <th className="p-3">DB Reserved</th>
                        <th className="p-3">DB Paid</th>
                        <th className="p-3">Drift</th>
                        <th className="p-3">Invariant Check</th>
                        <th className="p-3 text-right">S6 Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232738]">
                      {reconciliationReports.map(rep => (
                        <tr key={rep.saleId} className="hover:bg-[#1e2130]">
                          <td className="p-3 font-mono text-gray-400">#{rep.saleId}</td>
                          <td className="p-3 font-semibold text-white">{rep.saleTitle}</td>
                          <td className="p-3 font-mono">{rep.initialStock}</td>
                          <td className="p-3 font-mono text-amber-400 font-bold">{rep.redisStock}</td>
                          <td className="p-3 font-mono text-cyan-400">{rep.reservedCount}</td>
                          <td className="p-3 font-mono text-emerald-400">{rep.paidCount}</td>
                          <td className="p-3 font-mono">
                            <span className={rep.drift === 0 ? 'text-gray-400' : 'text-red-400 font-bold'}>
                              {rep.drift}
                            </span>
                          </td>
                          <td className="p-3">
                            {rep.isConsistent ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                                <CheckCircle2 size={12} /> Invariant Conserved
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 w-fit">
                                <AlertTriangle size={12} /> Drift Detected
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleRebuildRedis(rep.saleId)}
                              className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[11px] font-semibold border border-amber-500/30 flex items-center gap-1 ml-auto"
                            >
                              <RotateCcw size={12} /> Rebuild Redis (S6)
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* S7 Kafka Dead-Letter Topic (DLT) & Replay */}
              <div className="bg-[#171924] border border-[#232738] rounded-xl p-5">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="text-cyan-400" />
                    <div>
                      <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        Kafka Dead-Letter Handling & Replay (S7)
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        Topic: <span className="font-mono text-amber-400">order_events.DLT</span> | Unprocessed or Poison Pill Messages
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchDltMessages}
                      className="px-3 py-1.5 rounded-lg bg-[#1e2130] text-gray-300 hover:text-white border border-[#2d3248] text-xs"
                    >
                      Refresh DLT
                    </button>
                    <button
                      onClick={handleReplayDlt}
                      disabled={dltMessages.length === 0}
                      className="px-4 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Play size={12} /> Admin DLT Replay
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-[#141620] border border-[#202436] rounded-xl">
                  {dltMessages.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-xs">
                      <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500/60" />
                      DLT queue is clean. Zero failed or poison pill messages pending replay.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <span className="text-[11px] text-amber-400 font-mono font-bold block mb-2">
                        {dltMessages.length} Failed Message(s) in DLT:
                      </span>
                      {dltMessages.map((msg, idx) => (
                        <div key={idx} className="p-2.5 bg-[#1a1c2a] rounded-lg font-mono text-[10px] text-gray-300 overflow-x-auto border border-[#2a2e44]">
                          {msg}
                        </div>
                      ))}
                    </div>
                  )}
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

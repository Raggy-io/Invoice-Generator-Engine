import React, { useState, useEffect } from 'react';
import Toast from './components/Toast';
import Spinner from './components/Spinner';

function App() {
  const [orderId, setOrderId] = useState('DEMO-' + Math.floor(1000 + Math.random() * 9000));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  
  const [address, setAddress] = useState({
    firstName: 'John',
    lastName: 'Doe',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    mobile: '9876543210'
  });

  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  const [toast, setToast] = useState({ message: '', type: '' });
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  const [logoBase64, setLogoBase64] = useState(null);
  const [signatureBase64, setSignatureBase64] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!searchQuery) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/autocomplete?query=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSuggestions(data.results);
      } catch (e) {
        console.error("Failed to fetch autocomplete suggestions", e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, API_URL]);

  const handleFileUpload = (e, setBase64State) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBase64State(reader.result.split(',')[1]); // remove the data:image/png;base64, prefix
      };
      reader.readAsDataURL(file);
    } else {
      setBase64State(null);
    }
  };

  const addItemFromSuggestion = (product) => {
    setItems(prev => [...prev, {
      id: `P${Math.floor(Math.random()*1000)}`,
      name: product.name,
      hsn_code: product.hsn_code,
      price: product.price,
      quantity: 1
    }]);
    setSearchQuery('');
    setSuggestions([]);
    showToast(`Added ${product.name}`, 'success');
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const validateForm = () => {
    if (!orderId.trim()) return "Invoice Number is required";
    if (!address.firstName.trim()) return "First Name is required";
    if (!address.city.trim()) return "City is required";
    if (!address.state.trim()) return "State is required";
    if (items.length === 0) return "Please add at least one item";
    return null;
  };

  const fetchPdf = async () => {
    const error = validateForm();
    if (error) {
      showToast(error, 'error');
      return null;
    }

    const payload = {
      id: orderId,
      created_at: new Date(date).toISOString(),
      delivery_address: {
        ...address,
        isGstBilling: false
      },
      items: items,
      payment_method: paymentMethod,
      total_amount: calculateTotal(),
      company_logo: logoBase64,
      signature: signatureBase64
    };

    const res = await fetch(`${API_URL}/api/generate-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(()=>({}));
      throw new Error(errData.detail || "Failed to generate PDF");
    }
    
    return await res.blob();
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    try {
      const blob = await fetchPdf();
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        setPreviewUrl(url);
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const blob = await fetchPdf();
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice-${orderId}.pdf`;
        a.click();
        showToast("Invoice downloaded successfully!", 'success');
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ padding: '2rem', position: 'relative' }}>
      <button className="theme-toggle" onClick={toggleTheme} title="Toggle Dark Mode">
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Invoice Generator</h1>
        <p style={{ color: 'var(--terracotta)', fontSize: '1.2rem' }}>Professional Billing Solution</p>
      </header>

      <div className="layout-grid">
        {/* Left Column: Form */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div>
            <h3>1. Order Metadata</h3>
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label>Invoice Number</label>
                <input 
                  value={orderId} 
                  onChange={e => setOrderId(e.target.value)} 
                  className={!orderId.trim() ? 'invalid-input' : ''}
                />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Payment Method</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="UPI">UPI</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="COD">Cash on Delivery</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3>2. Customer Details</h3>
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label>First Name</label>
                <input 
                  value={address.firstName} 
                  onChange={e => setAddress({...address, firstName: e.target.value})} 
                  className={!address.firstName.trim() ? 'invalid-input' : ''}
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input value={address.lastName} onChange={e => setAddress({...address, lastName: e.target.value})} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>State</label>
                <input 
                  value={address.state} 
                  onChange={e => setAddress({...address, state: e.target.value})} 
                  className={!address.state.trim() ? 'invalid-input' : ''}
                />
              </div>
              <div className="form-group">
                <label>City</label>
                <input 
                  value={address.city} 
                  onChange={e => setAddress({...address, city: e.target.value})}
                  className={!address.city.trim() ? 'invalid-input' : ''}
                />
              </div>
              <div className="form-group">
                <label>Pincode</label>
                <input value={address.pincode} onChange={e => setAddress({...address, pincode: e.target.value})} />
              </div>
            </div>
          </div>

          <div>
            <h3>3. Branding & Assets</h3>
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label>Company Logo (Optional)</label>
                <input type="file" accept="image/png, image/jpeg" onChange={(e) => handleFileUpload(e, setLogoBase64)} />
              </div>
              <div className="form-group">
                <label>Authorized Signature (Optional)</label>
                <input type="file" accept="image/png, image/jpeg" onChange={(e) => handleFileUpload(e, setSignatureBase64)} />
              </div>
            </div>
          </div>

          <div>
            <h3>4. Line Items</h3>
            <div style={{ position: 'relative', marginTop: '1rem', marginBottom: '1rem' }}>
              <input 
                placeholder="Search products..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {suggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {suggestions.map((p, idx) => (
                    <div key={idx} className="suggestion-item" onClick={() => addItemFromSuggestion(p)}>
                      <strong>{p.name}</strong> - ₹{p.price} (HSN: {p.hsn_code})
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              {items.map((item, idx) => (
                <div key={idx} className="item-row">
                  <div>{item.name}</div>
                  <div>HSN: {item.hsn_code}</div>
                  <div>₹{item.price}</div>
                  <div>
                    <input 
                      type="number" 
                      value={item.quantity} 
                      min="1"
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx].quantity = parseInt(e.target.value) || 1;
                        setItems(newItems);
                      }}
                      style={{ padding: '0.25rem', width: '60px' }}
                    />
                  </div>
                  <button className="btn-secondary" onClick={() => removeItem(idx)}>X</button>
                </div>
              ))}
              {items.length === 0 && <p style={{ fontSize: '0.9rem', color: 'rgba(128,128,128,0.8)' }}>No items added yet.</p>}
            </div>
          </div>
        </div>

        {/* Right Column: Preview Summary */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--terracotta)', borderBottom: '1px solid rgba(128,128,128,0.1)', paddingBottom: '1rem' }}>Invoice Summary</h2>
          
          <div style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
            <p><strong>Billed To:</strong> {address.firstName} {address.lastName}</p>
            <p><strong>Location:</strong> {address.city}, {address.state} - {address.pincode}</p>
            <p><strong>Invoice No:</strong> {orderId}</p>
            <p><strong>Date:</strong> {date}</p>
          </div>

          <div style={{ background: 'var(--white)', borderRadius: '8px', padding: '1rem', marginBottom: '2rem' }}>
            <h4 style={{ marginBottom: '1rem', color: 'var(--cocoa)' }}>Total Items ({items.length})</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid rgba(128,128,128,0.05)', paddingTop: '1rem', marginTop: '1rem' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Grand Total</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--terracotta)' }}>₹{calculateTotal().toFixed(2)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              className="btn-secondary" 
              style={{ flex: 1, fontSize: '1.1rem', padding: '1rem' }}
              onClick={handlePreview}
              disabled={isPreviewing || isGenerating}
            >
              {isPreviewing ? <Spinner /> : 'Preview'}
            </button>
            <button 
              className="btn-primary" 
              style={{ flex: 1, fontSize: '1.1rem', padding: '1rem' }}
              onClick={handleGenerate}
              disabled={isGenerating || isPreviewing}
            >
              {isGenerating ? <Spinner /> : 'Download'}
            </button>
          </div>
          
          <p style={{ fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem', opacity: 0.7 }}>
            PDF generation is processed dynamically on the backend.
          </p>
        </div>
      </div>

      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: '' })} />

      {previewUrl && (
        <div className="modal-overlay" onClick={() => setPreviewUrl(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Invoice Preview</h3>
              <button className="btn-secondary" onClick={() => setPreviewUrl(null)}>Close</button>
            </div>
            <div className="modal-body">
              <iframe src={previewUrl} title="Invoice Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

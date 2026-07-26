import React, { useState, useEffect } from 'react';

function App() {
  const [orderId, setOrderId] = useState('DEMO-' + Math.floor(1000 + Math.random() * 9000));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  
  const [address, setAddress] = useState({
    firstName: 'Raghvendra',
    lastName: 'Singh',
    city: 'Noida',
    state: 'Uttar Pradesh',
    pincode: '201309',
    mobile: '9876543210'
  });

  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Debounced API call to our Python DSA Trie endpoint
  useEffect(() => {
    if (!searchQuery) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/autocomplete?query=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSuggestions(data.results);
      } catch (e) {
        console.error("Failed to fetch autocomplete suggestions", e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleGenerate = async () => {
    if (items.length === 0) {
      alert("Please add at least one item");
      return;
    }
    setIsGenerating(true);
    try {
      const payload = {
        id: orderId,
        created_at: new Date(date).toISOString(),
        delivery_address: {
          ...address,
          isGstBilling: false
        },
        items: items,
        payment_method: paymentMethod,
        total_amount: calculateTotal()
      };

      const res = await fetch('http://localhost:8000/api/generate-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Failed to generate PDF");
      
      // Download the PDF blob
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${orderId}.pdf`;
      a.click();
    } catch (e) {
      alert("Error: Ensure your Python FastAPI backend is running on port 8000. \n" + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Curated by Banjaras</h1>
        <p style={{ color: 'var(--terracotta)', fontSize: '1.2rem' }}>Enterprise Invoice Generator</p>
      </header>

      <div className="layout-grid">
        {/* Left Column: Form */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div>
            <h3>1. Order Metadata</h3>
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label>Order ID</label>
                <input value={orderId} onChange={e => setOrderId(e.target.value)} />
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
                <input value={address.firstName} onChange={e => setAddress({...address, firstName: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input value={address.lastName} onChange={e => setAddress({...address, lastName: e.target.value})} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>State</label>
                <input value={address.state} onChange={e => setAddress({...address, state: e.target.value})} />
              </div>
              <div className="form-group">
                <label>City</label>
                <input value={address.city} onChange={e => setAddress({...address, city: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Pincode</label>
                <input value={address.pincode} onChange={e => setAddress({...address, pincode: e.target.value})} />
              </div>
            </div>
          </div>

          <div>
            <h3>3. Line Items</h3>
            <div style={{ position: 'relative', marginTop: '1rem', marginBottom: '1rem' }}>
              <input 
                placeholder="Search products (Powered by DSA Trie Algorithm)..." 
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
              {items.length === 0 && <p style={{ fontSize: '0.9rem', color: 'rgba(0,0,0,0.5)' }}>No items added yet.</p>}
            </div>
          </div>
        </div>

        {/* Right Column: Preview Summary */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--terracotta)', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '1rem' }}>Invoice Summary</h2>
          
          <div style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
            <p><strong>Billed To:</strong> {address.firstName} {address.lastName}</p>
            <p><strong>Location:</strong> {address.city}, {address.state} - {address.pincode}</p>
            <p><strong>Order ID:</strong> {orderId}</p>
            <p><strong>Date:</strong> {date}</p>
          </div>

          <div style={{ background: 'white', borderRadius: '8px', padding: '1rem', marginBottom: '2rem' }}>
            <h4 style={{ marginBottom: '1rem', color: 'var(--cocoa)' }}>Total Items ({items.length})</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid rgba(0,0,0,0.05)', paddingTop: '1rem', marginTop: '1rem' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Grand Total</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--terracotta)' }}>₹{calculateTotal().toFixed(2)}</span>
            </div>
          </div>

          <button 
            className="btn-primary" 
            style={{ width: '100%', fontSize: '1.1rem', padding: '1rem' }}
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating PDF...' : 'Download Tax Invoice'}
          </button>
          
          <p style={{ fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem', opacity: 0.7 }}>
            PDF generation is processed by the Python backend via ReportLab.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;

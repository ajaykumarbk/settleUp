import React, { useState, useEffect } from 'react';
import { Plus, X, AlertTriangle, Scan, Camera, Sparkles, Trash2, Coins, ArrowRightLeft, HandCoins } from 'lucide-react';
import { api } from '../utils/api';

const receiptTemplates = {
  cafe: {
    merchant: 'Starbucks Cafe',
    amount: '15.70',
    category: 'Food',
    date: new Date().toISOString().split('T')[0],
    text: 'STARBUCKS CAFE #9822\n2x CARAMEL MACCHIATO - $10.50\n1x BLUEBERRY MUFFIN - $4.00\nTAX - $1.20\nTOTAL: $15.70\nTHANK YOU!'
  },
  dinner: {
    merchant: 'Olive Garden Dinner',
    amount: '90.00',
    category: 'Food',
    date: new Date().toISOString().split('T')[0],
    text: 'OLIVE GARDEN ITALIAN\n1x CHICKEN ALFREDO - $22.00\n1x LASAGNA CLASSICO - $18.50\n1x BOTTLE OF MERLOT - $35.00\nTAX & GRATUITY - $14.50\nTOTAL DUE: $90.00'
  },
  uber: {
    merchant: 'Uber Ride',
    amount: '34.80',
    category: 'Taxi',
    date: new Date().toISOString().split('T')[0],
    text: 'UBER TECHNOLOGIES INC.\nTRIP ID: 9812A-98F\nBASE FARE - $5.00\nDISTANCE CHARGE - $18.20\nSURGE CHARGES - $11.60\nTOTAL CHARGE: $34.80'
  }
};

export default function ExpenseModal({ isOpen, onClose, onSuccess, initialGroupId = null, initialFriendId = null, prefilledData = null }) {
  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(initialGroupId || '');
  const [selectedFriend, setSelectedFriend] = useState(initialFriendId || '');
  
  // Form fields
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState('General');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState('equal'); // 'equal', 'unequal', 'itemized', 'loan'
  const [receiptUrl, setReceiptUrl] = useState('');
  
  // Exchange Rates
  const [exchangeRates, setExchangeRates] = useState({});
  const [convertedInfo, setConvertedInfo] = useState('');

  // OCR Simulator
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTemplate, setScannerTemplate] = useState('');
  const [scanning, setScanning] = useState(false);

  // Itemized Split items
  const [items, setItems] = useState([{ id: 'item-1', name: '', price: '', consumers: [] }]);

  // Loan borrowers list (stores user IDs)
  const [borrowers, setBorrowers] = useState([]);

  // Participants and custom split amounts
  const [participants, setParticipants] = useState([]);
  const [customAmounts, setCustomAmounts] = useState({}); // { [userId]: amount }
  const [validationError, setValidationError] = useState('');

  const currentUser = api.auth.getUser();

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      // Load prefilled data if available, otherwise reset
      if (prefilledData) {
        setDescription(prefilledData.description || '');
        setAmount(prefilledData.amount || '');
        setCategory(prefilledData.category || 'General');
        setDate(prefilledData.date || new Date().toISOString().split('T')[0]);
      } else {
        setDescription('');
        setAmount('');
        setCategory('General');
        setDate(new Date().toISOString().split('T')[0]);
      }
      setCurrency('USD');
      setSplitType('equal');
      setCustomAmounts({});
      setValidationError('');
      setReceiptUrl('');
      setShowScanner(false);
      setScannerTemplate('');
      setItems([{ id: 'item-1', name: '', price: '', consumers: [] }]);
      setBorrowers([]);
      setSelectedGroup(initialGroupId || '');
      setSelectedFriend(initialFriendId || '');
    }
  }, [isOpen, initialGroupId, initialFriendId, prefilledData]);

  // Load initial groups, friends and exchange rates
  const loadInitialData = async () => {
    const groupsData = await api.groups.list();
    if (groupsData && !groupsData.error) setGroups(groupsData);

    const friendsData = await api.friends.list();
    if (friendsData && !friendsData.error) setFriends(friendsData);

    // Fetch live currency exchange rates
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await res.json();
      if (data && data.rates) {
        setExchangeRates(data.rates);
      }
    } catch (err) {
      console.warn('Could not fetch exchange rates, using static fallback');
      setExchangeRates({ USD: 1, EUR: 0.92, GBP: 0.78, INR: 83.5 });
    }
  };

  // Convert amounts dynamically when currency or amount changes
  useEffect(() => {
    const amtVal = parseFloat(amount);
    if (!amtVal || isNaN(amtVal) || currency === 'USD' || !exchangeRates[currency]) {
      setConvertedInfo('');
      return;
    }
    const converted = amtVal / exchangeRates[currency];
    setConvertedInfo(`≈ $${converted.toFixed(2)} USD`);
  }, [amount, currency, exchangeRates]);

  // Determine participants when group or friend selection changes
  useEffect(() => {
    let list = [];
    if (selectedGroup) {
      loadGroupMembers(selectedGroup);
    } else if (selectedFriend) {
      if (selectedFriend === 'personal') {
        if (currentUser) {
          list = [
            { id: currentUser.id, username: 'You', avatarUrl: currentUser.avatarUrl }
          ];
          setParticipants(list);
          setPaidBy(currentUser.id.toString());
          setBorrowers([]);
        }
      } else {
        const friendObj = friends.find(f => f.id === parseInt(selectedFriend));
        if (friendObj && currentUser) {
          list = [
            { id: currentUser.id, username: 'You', avatarUrl: currentUser.avatarUrl },
            { id: friendObj.id, username: friendObj.username, avatarUrl: friendObj.avatarUrl }
          ];
          setParticipants(list);
          setPaidBy(currentUser.id.toString());
          
          // Default borrowers = all participants except payer
          setBorrowers([friendObj.id]);

          // Initialize item consumers
          setItems(prev => prev.map(item => ({
            ...item,
            consumers: [currentUser.id, friendObj.id]
          })));
        }
      }
    } else {
      setParticipants([]);
      setPaidBy('');
      setBorrowers([]);
    }
  }, [selectedGroup, selectedFriend, friends]);

  const loadGroupMembers = async (groupId) => {
    const res = await api.groups.getDetails(groupId);
    if (res && !res.error) {
      const list = res.members.map(m => ({
        id: m.id,
        username: m.id === currentUser.id ? 'You' : m.username,
        avatarUrl: m.avatarUrl
      }));
      setParticipants(list);
      if (currentUser) {
        const defaultPayer = currentUser.id.toString();
        setPaidBy(defaultPayer);
        // Default borrowers = everyone except the payer
        setBorrowers(list.filter(m => m.id !== currentUser.id).map(m => m.id));
      }
      
      // Initialize item consumers to all members
      const memberIds = list.map(m => m.id);
      setItems(prev => prev.map(item => ({
        ...item,
        consumers: memberIds
      })));

      // If group has default splits configured, apply them!
      if (res.group.defaultSplitType && res.group.defaultSplitType !== 'equal') {
        setSplitType(res.group.defaultSplitType);
        if (res.group.defaultSplitType === 'unequal' && res.group.defaultSplitShares) {
          try {
            const sharesObj = JSON.parse(res.group.defaultSplitShares);
            const amtVal = parseFloat(amount) || 0;
            const updatedCustom = {};
            
            list.forEach(m => {
              const pct = sharesObj[m.id] || 0;
              updatedCustom[m.id] = ((pct / 100) * amtVal).toFixed(2);
            });
            setCustomAmounts(updatedCustom);
          } catch (e) {
            console.error('Failed to parse default split ratios', e);
          }
        }
      }
    }
  };

  // Sync default borrowers list when paidBy changes in Loan mode
  useEffect(() => {
    if (splitType === 'loan' && paidBy && participants.length > 0) {
      const payerId = parseInt(paidBy);
      // Autocheck everyone else as borrower
      setBorrowers(participants.filter(p => p.id !== payerId).map(p => p.id));
    }
  }, [paidBy, splitType, participants]);

  // Receipt Scanner Trigger
  const handleScanReceipt = () => {
    if (!scannerTemplate) return;
    setScanning(true);
    setTimeout(() => {
      const data = receiptTemplates[scannerTemplate];
      setDescription(data.merchant);
      setAmount(data.amount);
      setCategory(data.category);
      setDate(data.date);
      setReceiptUrl(`/uploads/simulated-${scannerTemplate}.jpg`);
      setScanning(false);
      setShowScanner(false);
    }, 1800);
  };

  // Upload file handlers
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const res = await api.expenses.uploadReceipt(file);
    if (res && res.receiptUrl) {
      setReceiptUrl(res.receiptUrl);
      setDescription(file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "));
    }
  };

  // Itemized Split handlers
  const handleAddItem = () => {
    const memberIds = participants.map(p => p.id);
    setItems(prev => [
      ...prev,
      { id: `item-${Date.now()}`, name: '', price: '', consumers: memberIds }
    ]);
  };

  const handleRemoveItem = (id) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleItemChange = (id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleConsumerToggle = (itemId, userId) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const copy = [...item.consumers];
        const idx = copy.indexOf(userId);
        if (idx > -1) {
          copy.splice(idx, 1);
        } else {
          copy.push(userId);
        }
        return { ...item, consumers: copy };
      }
      return item;
    }));
  };

  const getItemizedTotal = () => {
    return items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  };

  useEffect(() => {
    if (splitType === 'itemized') {
      setAmount(getItemizedTotal().toFixed(2));
    }
  }, [items, splitType]);

  const calculateItemizedSplits = () => {
    const memberShares = {};
    participants.forEach(p => { memberShares[p.id] = 0; });

    items.forEach(item => {
      const price = parseFloat(item.price) || 0;
      const count = item.consumers.length;
      if (price > 0 && count > 0) {
        const perPersonShare = price / count;
        item.consumers.forEach(cId => {
          if (memberShares[cId] !== undefined) {
            memberShares[cId] += perPersonShare;
          }
        });
      }
    });

    return memberShares;
  };

  // Loan split helpers
  const handleBorrowerToggle = (userId) => {
    setBorrowers(prev => {
      const copy = [...prev];
      const idx = copy.indexOf(userId);
      if (idx > -1) {
        copy.splice(idx, 1);
      } else {
        copy.push(userId);
      }
      return copy;
    });
  };

  const getLoanSplits = () => {
    const finalAmount = parseFloat(amount) || 0;
    if (borrowers.length === 0) return {};
    const share = finalAmount / borrowers.length;
    const shares = {};
    borrowers.forEach(bId => {
      shares[bId] = share;
    });
    return shares;
  };

  // Live equal splits preview
  const parsedAmount = parseFloat(amount) || 0;
  const equalSplitShare = participants.length > 0 ? (parsedAmount / participants.length) : 0;

  // Live unequal split remaining counter
  const getUnequalTotal = () => {
    return participants.reduce((sum, p) => sum + (parseFloat(customAmounts[p.id]) || 0), 0);
  };

  const handleCustomAmountChange = (userId, value) => {
    setCustomAmounts(prev => ({ ...prev, [userId]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (participants.length === 0) {
      setValidationError('Please select a group or friend to split with.');
      return;
    }

    const finalAmount = parseFloat(amount);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      setValidationError('Please enter a valid amount greater than $0.');
      return;
    }

    // Build splits array
    let splits = [];
    if (splitType === 'equal') {
      const share = Math.round((finalAmount / participants.length) * 100) / 100;
      let runningSum = 0;
      participants.forEach((p, idx) => {
        let personalShare = share;
        if (idx === participants.length - 1) {
          personalShare = Math.round((finalAmount - runningSum) * 100) / 100;
        } else {
          runningSum += share;
        }
        splits.push({ userId: p.id, amount: personalShare });
      });
    } else if (splitType === 'unequal') {
      const sum = getUnequalTotal();
      if (Math.abs(sum - finalAmount) > 0.05) {
        setValidationError(`Split totals ($${sum.toFixed(2)}) must sum up exactly to the overall amount ($${finalAmount.toFixed(2)})`);
        return;
      }
      splits = participants.map(p => ({
        userId: p.id,
        amount: Math.round((parseFloat(customAmounts[p.id]) || 0) * 100) / 100
      }));
    } else if (splitType === 'itemized') {
      const shares = calculateItemizedSplits();
      splits = participants.map(p => ({
        userId: p.id,
        amount: Math.round((shares[p.id] || 0) * 100) / 100
      }));
    } else {
      // Loan splits submission
      if (borrowers.length === 0) {
        setValidationError('Please select at least one borrower for this loan.');
        return;
      }
      const share = Math.round((finalAmount / borrowers.length) * 100) / 100;
      let runningSum = 0;
      borrowers.forEach((bId, idx) => {
        let personalShare = share;
        if (idx === borrowers.length - 1) {
          personalShare = Math.round((finalAmount - runningSum) * 100) / 100;
        } else {
          runningSum += share;
        }
        splits.push({ userId: bId, amount: personalShare });
      });
    }

    const expenseData = {
      description: splitType === 'loan' && !description.toLowerCase().startsWith('loan:') ? `Loan: ${description}` : description,
      amount: finalAmount,
      currency,
      paidBy: parseInt(paidBy),
      groupId: selectedGroup ? parseInt(selectedGroup) : null,
      category: splitType === 'loan' ? 'General' : category,
      date,
      receiptUrl: receiptUrl || null,
      splits
    };

    const res = await api.expenses.create(expenseData);
    if (res.error) {
      setValidationError(res.message);
    } else {
      onSuccess();
      onClose();
    }
  };

  if (!isOpen) return null;

  const unequalRemaining = parsedAmount - getUnequalTotal();
  const itemizedSplitsCalculated = splitType === 'itemized' ? calculateItemizedSplits() : {};
  const loanSplitsCalculated = splitType === 'loan' ? getLoanSplits() : {};
  const payerIdNum = parseInt(paidBy) || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 style={{ fontSize: '1.35rem' }}>Add an Expense</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* OCR Scanner Panel */}
        <div className="glass-panel" style={{
          padding: '16px',
          marginBottom: '20px',
          background: 'rgba(99, 102, 241, 0.02)',
          border: '1px dashed var(--border-color-glow)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
              <Scan size={16} style={{ color: 'var(--color-primary)' }} />
              <span>Smart Receipt OCR Scanner</span>
            </div>
            
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => setShowScanner(!showScanner)}
            >
              {showScanner ? 'Hide Scanner' : 'Use Smart Scanner'}
            </button>
          </div>

          {showScanner && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  className="form-control"
                  value={scannerTemplate}
                  onChange={e => setScannerTemplate(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '0.8rem', flex: 1 }}
                >
                  <option value="">-- Select Mock Receipt Template --</option>
                  <option value="cafe">Starbucks Cafe Coffee ($15.70)</option>
                  <option value="dinner">Olive Garden Dinner ($90.00)</option>
                  <option value="uber">Uber Taxi Ride ($34.80)</option>
                </select>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={handleScanReceipt}
                  disabled={!scannerTemplate || scanning}
                >
                  <Camera size={14} />
                  <span>Scan Receipt</span>
                </button>
              </div>

              {/* Receipt scanning visualization */}
              {scannerTemplate && (
                <div style={{
                  position: 'relative',
                  background: '#f8fafc',
                  color: '#334155',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)'
                }}>
                  {scanning && (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: 'rgba(99,102,241,0.8)',
                      boxShadow: '0 0 10px rgba(99,102,241,0.8)',
                      animation: 'scanLine 1.5s infinite linear',
                      top: 0
                    }} />
                  )}
                  {receiptTemplates[scannerTemplate].text}
                </div>
              )}
            </div>
          )}

          {/* Image Upload Input */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {receiptUrl ? `📎 Receipt Uploaded: ${receiptUrl.slice(0, 30)}...` : 'No receipt file attached'}
            </span>
            <label className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>
              <span>Upload Bill</span>
              <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} accept="image/*" />
            </label>
          </div>
        </div>

        {validationError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px',
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-danger)',
            fontSize: '0.85rem',
            marginBottom: '16px'
          }}>
            <AlertTriangle size={18} />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Selectors */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Split in Group</label>
              <select className="form-control" value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
                <option value="">No Group (Direct split)</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Or Select Friend</label>
              <select className="form-control" value={selectedFriend} onChange={e => setSelectedFriend(e.target.value)} disabled={!!selectedGroup}>
                <option value="">-- Choose Friend --</option>
                <option value="personal">Individual / Personal (No split)</option>
                {friends.map(f => (
                  <option key={f.id} value={f.id}>{f.username}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description & Amount & Currency */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input type="text" className="form-control" placeholder="e.g. Starbucks, Uber" value={description} onChange={e => setDescription(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Amount</label>
              <input type="number" step="0.01" min="0.01" className="form-control" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required disabled={splitType === 'itemized'} />
            </div>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select className="form-control" value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
          </div>

          {convertedInfo && (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', marginTop: '-12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <ArrowRightLeft size={12} />
              <span>{convertedInfo}</span>
            </div>
          )}

          {/* Category & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-control" value={category} onChange={e => setCategory(e.target.value)} disabled={splitType === 'loan'}>
                <option value="General">General</option>
                <option value="Food">Food / Dining</option>
                <option value="Lodging">Lodging / Rent</option>
                <option value="Taxi">Taxi / Travel</option>
                <option value="Utilities">Utilities / Bills</option>
                <option value="Entertainment">Entertainment</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
          </div>

          {participants.length > 1 && (
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
              {/* Paid By Selection */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Who Paid?</label>
                <select className="form-control" value={paidBy} onChange={e => setPaidBy(e.target.value)}>
                  {participants.map(p => (
                    <option key={p.id} value={p.id}>{p.username}</option>
                  ))}
                </select>
              </div>

              {/* Split Option Tabs */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Split Setup</label>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                  <button type="button" className={`btn ${splitType === 'equal' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1, padding: '6px', fontSize: '0.85rem' }} onClick={() => setSplitType('equal')}>Equally</button>
                  <button type="button" className={`btn ${splitType === 'unequal' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1, padding: '6px', fontSize: '0.85rem' }} onClick={() => setSplitType('unequal')}>Unequally</button>
                  <button type="button" className={`btn ${splitType === 'itemized' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1, padding: '6px', fontSize: '0.85rem' }} onClick={() => setSplitType('itemized')}>Itemized</button>
                  <button type="button" className={`btn ${splitType === 'loan' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1, padding: '6px', fontSize: '0.85rem' }} onClick={() => setSplitType('loan')}>Loan</button>
                </div>
              </div>

              {/* 1. Itemized Split Panel */}
              {splitType === 'itemized' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '8px 0' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Receipt Line Items
                  </span>

                  {items.map((item, idx) => (
                    <div key={item.id} style={{
                      padding: '12px',
                      background: 'rgba(255,255,255,0.01)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder={`Item ${idx + 1} Name`}
                          value={item.name}
                          onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                        />
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          placeholder="Price"
                          value={item.price}
                          onChange={e => handleItemChange(item.id, 'price', e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '0.85rem', width: '90px', textAlign: 'right' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                          title="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Who ate/shared this item */}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shared by:</span>
                        {participants.map(p => {
                          const checked = item.consumers.includes(p.id);
                          return (
                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleConsumerToggle(item.id, p.id)}
                              />
                              <span>{p.username}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem', alignSelf: 'flex-start' }}
                    onClick={handleAddItem}
                  >
                    <Plus size={14} />
                    <span>Add Item</span>
                  </button>
                </div>
              )}

              {/* 2. Loan Mode Split Panel */}
              {splitType === 'loan' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '8px 0', background: 'rgba(99,102,241,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color-glow)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                    <HandCoins size={16} />
                    <span>Loan Setup (Payer lends 100% of amount)</span>
                  </div>
                  
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    Select who is borrowing this loan. The payer's own split share is automatically set to $0.
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {participants.map(p => {
                      if (p.id === payerIdNum) return null; // Exclude the lender
                      const isBorrower = borrowers.includes(p.id);
                      
                      return (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="checkbox"
                              checked={isBorrower}
                              onChange={() => handleBorrowerToggle(p.id)}
                            />
                            <span>{p.username}</span>
                          </div>
                          {isBorrower && (
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                              borrows ${(parsedAmount / Math.max(borrowers.length, 1)).toFixed(2)}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Standard Splits Display Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Split breakdown
                </span>

                {participants.map(p => {
                  let userAmt = 0;
                  if (splitType === 'equal') {
                    userAmt = equalSplitShare;
                  } else if (splitType === 'unequal') {
                    userAmt = parseFloat(customAmounts[p.id]) || 0;
                  } else if (splitType === 'itemized') {
                    userAmt = itemizedSplitsCalculated[p.id] || 0;
                  } else {
                    // Loan splits
                    userAmt = loanSplitsCalculated[p.id] || 0;
                  }

                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={p.avatarUrl} alt={p.username} className="avatar avatar-sm" style={{ width: '24px', height: '24px' }} />
                        <span style={{ fontSize: '0.9rem' }}>{p.username}</span>
                      </div>

                      {splitType === 'unequal' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>$</span>
                          <input
                            type="number"
                            step="0.01"
                            style={{ width: '80px', padding: '6px', textAlign: 'right' }}
                            className="form-control"
                            placeholder="0.00"
                            value={customAmounts[p.id] || ''}
                            onChange={e => handleCustomAmountChange(p.id, e.target.value)}
                          />
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.95rem', fontWeight: 500 }} className={userAmt > 0 ? 'amt-neutral' : 'amt-muted'}>
                          ${userAmt.toFixed(2)}
                        </span>
                      )}
                    </div>
                  );
                })}

                {splitType === 'unequal' && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'flex-end', 
                    fontSize: '0.85rem', 
                    marginTop: '8px', 
                    fontWeight: 600, 
                    color: Math.abs(unequalRemaining) < 0.05 ? 'var(--color-success)' : 'var(--color-danger)'
                  }}>
                    {Math.abs(unequalRemaining) < 0.05 ? (
                      <span>✓ Balanced!</span>
                    ) : unequalRemaining > 0 ? (
                      <span>Remaining to allocate: ${unequalRemaining.toFixed(2)}</span>
                    ) : (
                      <span>Overallocated by: ${Math.abs(unequalRemaining).toFixed(2)}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Expense</button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes scanLine {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        .spin-anim {
          animation: spin 1s infinite linear;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

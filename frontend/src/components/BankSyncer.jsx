import React, { useState } from 'react';
import { CreditCard, Link as LinkIcon, Check, ArrowRight, RefreshCw, Smartphone } from 'lucide-react';

const mockTransactions = [
  { id: 'tx-1', merchant: 'Starbucks Coffee', amount: 14.50, category: 'Food', date: new Date().toISOString().split('T')[0] },
  { id: 'tx-2', merchant: 'Uber Ride', amount: 24.80, category: 'Taxi', date: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
  { id: 'tx-3', merchant: 'Airbnb Lodging', amount: 120.00, category: 'Lodging', date: new Date(Date.now() - 172800000).toISOString().split('T')[0] },
  { id: 'tx-4', merchant: 'Electric Grid Co.', amount: 55.00, category: 'Utilities', date: new Date(Date.now() - 259200000).toISOString().split('T')[0] },
  { id: 'tx-5', merchant: 'Grand Theater Cinema', amount: 18.00, category: 'Entertainment', date: new Date(Date.now() - 345600000).toISOString().split('T')[0] }
];

export default function BankSyncer({ onImportClick }) {
  const [isLinked, setIsLinked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importedIds, setImportedIds] = useState(new Set());

  const handleLinkCard = () => {
    setLoading(true);
    setTimeout(() => {
      setIsLinked(true);
      setLoading(false);
    }, 1200);
  };

  const handleImport = (tx) => {
    onImportClick({
      description: tx.merchant,
      amount: tx.amount.toString(),
      category: tx.category,
      date: tx.date
    });
    setImportedIds(prev => {
      const copy = new Set(prev);
      copy.add(tx.id);
      return copy;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CreditCard size={22} style={{ color: 'var(--color-primary)' }} />
          <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
            Transaction Import
          </h2>
        </div>
        
        {isLinked && (
          <button 
            className="btn btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '6px' }}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 800);
            }}
            disabled={loading}
          >
            <RefreshCw size={12} className={loading ? 'spin-anim' : ''} />
            <span>Sync Purchases</span>
          </button>
        )}
      </div>

      {!isLinked ? (
        // Unlinked State
        <div className="glass-panel" style={{
          padding: '40px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)'
          }}>
            <CreditCard size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '6px' }}>Link your Credit or Debit Cards</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto', lineHeight: '1.5' }}>
              Import purchases directly from your bank. Review and split transactions with one click. We support 10,000+ banks globally.
            </p>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={handleLinkCard}
            disabled={loading}
            style={{ marginTop: '8px' }}
          >
            <LinkIcon size={16} />
            <span>{loading ? 'Connecting Securely...' : 'Connect Bank Card'}</span>
          </button>
        </div>
      ) : (
        // Linked State
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          alignItems: 'start'
        }}>
          {/* Card Showcase */}
          <div className="glass-panel" style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            border: '1px solid rgba(99,102,241,0.2)',
            padding: '24px',
            height: '200px',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Hologram details */}
            <div style={{
              position: 'absolute',
              right: '-40px',
              bottom: '-40px',
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
              pointerEvents: 'none'
            }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                  Linked Account
                </span>
                <h4 style={{ color: '#fff', fontSize: '1.05rem', marginTop: '2px', fontWeight: 600 }}>Chase Sapphire Reserve</h4>
              </div>
              <Smartphone size={24} style={{ color: 'rgba(255,255,255,0.3)' }} />
            </div>

            <div style={{ fontSize: '1.25rem', letterSpacing: '0.2em', fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.85)', margin: '14px 0' }}>
              ••••  ••••  ••••  9821
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <span style={{ fontSize: '0.55rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Cardholder</span>
                <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 500 }}>AJAY KUMAR</div>
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, italic: 'true', color: 'rgba(255,255,255,0.8)' }}>VISA</span>
            </div>
          </div>

          {/* Transactions List */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', color: 'var(--text-primary)' }}>
              Recent Transactions ({mockTransactions.length})
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {mockTransactions.map(tx => {
                const isImported = importedIds.has(tx.id);
                
                return (
                  <div key={tx.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-color)',
                    opacity: isImported ? 0.6 : 1,
                    transition: 'var(--transition-smooth)'
                  }}>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>{tx.merchant}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {tx.date} • {tx.category}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                        ${tx.amount.toFixed(2)}
                      </span>

                      {isImported ? (
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'var(--color-success-bg)',
                          border: '1px solid var(--color-success-border)',
                          color: 'var(--color-success)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Check size={14} />
                        </div>
                      ) : (
                        <button
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '4px' }}
                          onClick={() => handleImport(tx)}
                        >
                          <span>Import</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

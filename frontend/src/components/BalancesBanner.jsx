import React from 'react';
import { ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react';

export default function BalancesBanner({ total, youOwe, youAreOwed }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '20px',
      marginBottom: '32px'
    }}>
      {/* 1. Total Balance Card */}
      <div className="glass-panel" style={{
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '18px',
        borderLeft: '4px solid var(--color-primary)'
      }}>
        <div style={{
          padding: '12px',
          borderRadius: '12px',
          background: 'rgba(99, 102, 241, 0.1)',
          color: 'var(--color-primary)'
        }}>
          <Wallet size={24} />
        </div>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Total Net Balance
          </span>
          <h3 style={{
            fontSize: '1.6rem',
            fontFamily: 'var(--font-display)',
            marginTop: '4px'
          }} className={total > 0 ? 'amt-positive' : total < 0 ? 'amt-negative' : ''}>
            {total > 0 ? `+$${total.toFixed(2)}` : total < 0 ? `-$${Math.abs(total).toFixed(2)}` : '$0.00'}
          </h3>
        </div>
      </div>

      {/* 2. You Owe Card */}
      <div className="glass-panel" style={{
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '18px',
        borderLeft: '4px solid var(--color-danger)'
      }}>
        <div style={{
          padding: '12px',
          borderRadius: '12px',
          background: 'rgba(244, 63, 94, 0.1)',
          color: 'var(--color-danger)'
        }}>
          <ArrowDownLeft size={24} />
        </div>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            You Owe
          </span>
          <h3 style={{
            fontSize: '1.6rem',
            fontFamily: 'var(--font-display)',
            marginTop: '4px',
            color: 'var(--color-danger)'
          }}>
            ${Math.abs(youOwe).toFixed(2)}
          </h3>
        </div>
      </div>

      {/* 3. You Are Owed Card */}
      <div className="glass-panel" style={{
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '18px',
        borderLeft: '4px solid var(--color-success)'
      }}>
        <div style={{
          padding: '12px',
          borderRadius: '12px',
          background: 'rgba(16, 185, 129, 0.1)',
          color: 'var(--color-success)'
        }}>
          <ArrowUpRight size={24} />
        </div>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            You Are Owed
          </span>
          <h3 style={{
            fontSize: '1.6rem',
            fontFamily: 'var(--font-display)',
            marginTop: '4px',
            color: 'var(--color-success)'
          }}>
            ${youAreOwed.toFixed(2)}
          </h3>
        </div>
      </div>
    </div>
  );
}

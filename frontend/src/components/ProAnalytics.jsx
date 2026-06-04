import React from 'react';
import { PieChart, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { getCategoryIcon } from '../pages/Dashboard';
import { api } from '../utils/api';

export default function ProAnalytics({ expenses = [] }) {
  const currentUser = api.auth.getUser();

  // 1. Calculate spending by category
  const categories = {
    Food: { amount: 0, color: '#f59e0b', label: 'Food / Dining' },
    Lodging: { amount: 0, color: '#10b981', label: 'Lodging / Rent' },
    Taxi: { amount: 0, color: '#3b82f6', label: 'Taxi / Travel' },
    Utilities: { amount: 0, color: '#a855f7', label: 'Utilities / Bills' },
    Entertainment: { amount: 0, color: '#ec4899', label: 'Entertainment' },
    General: { amount: 0, color: '#64748b', label: 'General' }
  };

  let totalSpent = 0;
  expenses.forEach(e => {
    const cat = e.category || 'General';
    const mySplit = e.splits ? e.splits.find(s => s.userId === currentUser?.id) : null;
    const amt = mySplit ? mySplit.amount : (e.splits && e.splits.length > 0 ? 0 : parseFloat(e.amount) || 0);

    if (categories[cat]) {
      categories[cat].amount += amt;
    } else {
      categories['General'].amount += amt;
    }
    totalSpent += amt;
  });

  // 2. Prepare Donut Chart calculations
  const chartData = Object.entries(categories)
    .map(([key, value]) => ({
      name: key,
      ...value,
      percentage: totalSpent > 0 ? (value.amount / totalSpent) * 100 : 0
    }))
    .filter(c => c.amount > 0);

  // SVG Donut coordinates helper
  let accumulatedPercentage = 0;
  const donutRadius = 70;
  const donutCircumference = 2 * Math.PI * donutRadius;

  // 3. Calculate Monthly spending trends (last 6 months)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyTotals = {};
  
  // Initialize last 6 months
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
    monthlyTotals[label] = 0;
  }

  // Populate monthly totals
  expenses.forEach(e => {
    if (!e.date) return;
    const d = new Date(e.date);
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
    if (monthlyTotals[label] !== undefined) {
      const mySplit = e.splits ? e.splits.find(s => s.userId === currentUser?.id) : null;
      const amt = mySplit ? mySplit.amount : (e.splits && e.splits.length > 0 ? 0 : parseFloat(e.amount) || 0);
      monthlyTotals[label] += amt;
    }
  });

  const trendData = Object.entries(monthlyTotals).map(([month, amount]) => ({
    month,
    amount
  }));

  const maxMonthlyAmount = Math.max(...trendData.map(t => t.amount), 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <PieChart size={22} style={{ color: 'var(--color-primary)' }} />
        <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          Advanced Spending Analytics
        </h2>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px'
      }}>
        {/* Category Donut Card */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '20px', color: 'var(--text-primary)' }}>
            Spending by Category
          </h3>

          {chartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No expense data available to visualize.
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
              {/* SVG Donut */}
              <div style={{ position: 'relative', width: '180px', height: '180px', flexShrink: 0 }}>
                <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="90"
                    cy="90"
                    r={donutRadius}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.02)"
                    strokeWidth="18"
                  />
                  {chartData.map((slice, idx) => {
                    const strokeDash = (slice.percentage / 100) * donutCircumference;
                    const strokeOffset = donutCircumference - (accumulatedPercentage / 100) * donutCircumference;
                    accumulatedPercentage += slice.percentage;

                    return (
                      <circle
                        key={slice.name}
                        cx="90"
                        cy="90"
                        r={donutRadius}
                        fill="transparent"
                        stroke={slice.color}
                        strokeWidth="18"
                        strokeDasharray={`${strokeDash} ${donutCircumference}`}
                        strokeDashoffset={strokeOffset}
                        strokeLinecap="round"
                        style={{
                          transition: 'stroke-dashoffset 0.5s ease',
                          filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))'
                        }}
                      />
                    );
                  })}
                </svg>
                {/* Center Label */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Spent</span>
                  <strong style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                    ${totalSpent.toFixed(0)}
                  </strong>
                </div>
              </div>

              {/* Legend List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '160px' }}>
                {chartData.map(slice => (
                  <div key={slice.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: slice.color, flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {slice.name}
                      </span>
                    </div>
                    <span style={{ fontWeight: 600 }}>
                      ${slice.amount.toFixed(0)} ({slice.percentage.toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Monthly Trends Column Chart */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '20px', color: 'var(--text-primary)' }}>
            Monthly Expenditure Trend
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* SVG Column Bars */}
            <div style={{ height: '140px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 10px', borderBottom: '1px solid var(--border-color)', gap: '12px' }}>
              {trendData.map(t => {
                const barHeight = (t.amount / maxMonthlyAmount) * 110; // scale to 110px max height
                
                return (
                  <div key={t.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px' }}>
                    {/* Hover amount tooltip */}
                    <div style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: t.amount > 0 ? 'var(--color-primary)' : 'var(--text-muted)',
                      transition: 'var(--transition-smooth)'
                    }}>
                      ${t.amount.toFixed(0)}
                    </div>
                    {/* The Bar */}
                    <div style={{
                      width: '100%',
                      maxWidth: '30px',
                      height: `${Math.max(barHeight, 4)}px`,
                      background: t.amount > 0 
                        ? 'linear-gradient(to top, var(--color-primary), #818cf8)' 
                        : 'rgba(255,255,255,0.02)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: t.amount > 0 ? '0 0 8px rgba(99, 102, 241, 0.2)' : 'none'
                    }} />
                  </div>
                );
              })}
            </div>
            
            {/* Month labels footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 10px' }}>
              {trendData.map(t => (
                <div key={t.month} style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--text-muted)', 
                  flex: 1, 
                  textAlign: 'center' 
                }}>
                  {t.month}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

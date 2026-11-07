import React, { useState, useEffect } from 'react';
import './AccountingLedger.css';

interface JournalLine {
  accountCode: string;
  accountName: string;
  accountType: 'ASSET' | 'LIABILITY' | 'REVENUE' | 'EXPENSE';
  side: 'DEBIT' | 'CREDIT';
  amountUgx: number;
  memo: string;
}

interface JournalEntry {
  id: number;
  entryRef: string;
  entryDate: string;
  periodLabel: string;
  sourceModule: 'RESTAURANTS' | 'TICKETING' | 'RENT' | 'SYSTEM';
  eventType: string;
  eventRef: string;
  status: 'POSTED' | 'DRAFT' | 'FAILED';
  lines: JournalLine[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

interface LedgerResponse {
  entries: JournalEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  summary: {
    totalDebits: number;
    totalCredits: number;
    variance: number;
  };
}

interface FailedPosting {
  id: number;
  sourceModule: string;
  eventType: string;
  eventRef: string;
  errorMessage: string;
  createdAt: string;
}

const AccountingLedger: React.FC = () => {
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [failures, setFailures] = useState<FailedPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());
  const [showAllExpanded, setShowAllExpanded] = useState(true);
  const [showFailures, setShowFailures] = useState(false);
  
  // Filters
  const [fromDate, setFromDate] = useState('2026-11-01');
  const [toDate, setToDate] = useState('2026-11-30');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('POSTED');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLedgerData();
    fetchFailures();
  }, [fromDate, toDate, selectedModule, selectedAccount, selectedStatus, currentPage]);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        fromDate,
        toDate,
        page: currentPage.toString(),
        limit: '50',
      });
      if (selectedModule !== 'ALL') params.append('module', selectedModule);
      if (selectedAccount !== 'ALL') params.append('account', selectedAccount);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);

      const response = await fetch(`/api/admin/accounting/ledger?${params}`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch ledger:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFailures = async () => {
    try {
      const response = await fetch('/api/admin/accounting/failures');
      const result = await response.json();
      setFailures(result.failures || []);
    } catch (error) {
      console.error('Failed to fetch failures:', error);
    }
  };

  const toggleEntry = (entryId: number) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  const toggleAllEntries = () => {
    if (showAllExpanded) {
      setExpandedEntries(new Set());
    } else {
      const allIds = new Set(data?.entries.map(e => e.id) || []);
      setExpandedEntries(allIds);
    }
    setShowAllExpanded(!showAllExpanded);
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-UG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  const getModuleBadgeClass = (module: string): string => {
    const classes: Record<string, string> = {
      RESTAURANTS: 'module-badge-restaurants',
      TICKETING: 'module-badge-ticketing',
      RENT: 'module-badge-rent',
      SYSTEM: 'module-badge-system',
    };
    return classes[module] || 'module-badge-default';
  };

  const getAccountTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      ASSET: '📊',
      LIABILITY: '📋',
      REVENUE: '💰',
      EXPENSE: '💸',
    };
    return icons[type] || '📄';
  };

  const getStatusBadge = (status: string): JSX.Element => {
    if (status === 'POSTED') {
      return <span className="status-badge status-posted">✓ Posted</span>;
    } else if (status === 'DRAFT') {
      return <span className="status-badge status-draft">⏱ Draft</span>;
    } else {
      return <span className="status-badge status-failed">✗ Failed</span>;
    }
  };

  const retryFailure = async (id: number) => {
    try {
      await fetch(`/api/admin/accounting/failures/${id}/retry`, { method: 'POST' });
      fetchFailures();
      fetchLedgerData();
    } catch (error) {
      console.error('Failed to retry:', error);
    }
  };

  const dismissFailure = async (id: number) => {
    try {
      await fetch(`/api/admin/accounting/failures/${id}`, { method: 'DELETE' });
      fetchFailures();
    } catch (error) {
      console.error('Failed to dismiss:', error);
    }
  };

  if (loading && !data) {
    return (
      <div className="ledger-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading ledger...</p>
        </div>
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.pagination.total / data.pagination.limit) : 1;
  const isBalanced = data ? data.summary.variance === 0 : true;

  return (
    <div className="ledger-container">
      {/* Header */}
      <div className="ledger-header">
        <div className="header-left">
          <h1>📚 General Ledger</h1>
          <span className="live-indicator">
            <span className="live-dot"></span> Live
          </span>
        </div>
        <div className="header-right">
          <button className="btn-export">Export to CSV</button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-icon">📄</div>
          <div className="metric-content">
            <div className="metric-value">{data?.pagination.total.toLocaleString() || 0}</div>
            <div className="metric-label">Journal Entries</div>
          </div>
        </div>

        <div className="metric-card metric-debit">
          <div className="metric-icon">↗️</div>
          <div className="metric-content">
            <div className="metric-value">UGX {formatAmount(data?.summary.totalDebits || 0)}</div>
            <div className="metric-label">Total Debits</div>
          </div>
        </div>

        <div className="metric-card metric-credit">
          <div className="metric-icon">↘️</div>
          <div className="metric-content">
            <div className="metric-value">UGX {formatAmount(data?.summary.totalCredits || 0)}</div>
            <div className="metric-label">Total Credits</div>
          </div>
        </div>

        <div className={`metric-card ${isBalanced ? 'metric-balanced' : 'metric-imbalanced'}`}>
          <div className="metric-icon">{isBalanced ? '✓' : '⚠️'}</div>
          <div className="metric-content">
            <div className="metric-value">
              {isBalanced ? 'Balanced' : `UGX ${formatAmount(Math.abs(data?.summary.variance || 0))}`}
            </div>
            <div className="metric-label">{isBalanced ? 'Perfect Balance' : 'Imbalance Detected'}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-row">
          <div className="filter-group">
            <label>From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Module</label>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Modules</option>
              <option value="RESTAURANTS">Restaurants</option>
              <option value="TICKETING">Ticketing</option>
              <option value="RENT">Rent</option>
              <option value="SYSTEM">System</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Account</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Accounts</option>
              <optgroup label="Assets">
                <option value="1000">1000 - MoMo/PSP Clearing</option>
                <option value="1100">1100 - Rent Receivable</option>
                <option value="1300">1300 - Commission Receivable</option>
              </optgroup>
              <optgroup label="Liabilities">
                <option value="2100">2100 - Deferred Revenue</option>
                <option value="2200">2200 - Security Deposits</option>
              </optgroup>
              <optgroup label="Revenue">
                <option value="3000">3000 - Platform Comm - Restaurants</option>
                <option value="3010">3010 - Platform Comm - Rent</option>
                <option value="3020">3020 - Platform Comm - Ticketing</option>
              </optgroup>
              <optgroup label="Expenses">
                <option value="4000">4000 - PSP Transaction Fees</option>
                <option value="4100">4100 - Refunds Issued</option>
              </optgroup>
            </select>
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Statuses</option>
              <option value="POSTED">Posted</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

          <div className="filter-group filter-search">
            <label>Search</label>
            <input
              type="text"
              placeholder="Entry ref, event ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-input"
            />
          </div>
        </div>
      </div>

      {/* Table Controls */}
      <div className="table-controls">
        <button onClick={toggleAllEntries} className="btn-toggle">
          {showAllExpanded ? '⊟ Collapse All' : '⊞ Expand All'}
        </button>
        <div className="entries-count">
          Showing {data?.entries.length || 0} of {data?.pagination.total || 0} entries
        </div>
      </div>

      {/* Ledger Table */}
      <div className="ledger-table-container">
        <table className="ledger-table">
          <thead>
            <tr>
              <th className="col-id">#</th>
              <th className="col-date">Date</th>
              <th className="col-ref">Entry Ref</th>
              <th className="col-module">Module</th>
              <th className="col-event">Event Type</th>
              <th className="col-event-ref">Event Ref</th>
              <th className="col-account">Account</th>
              <th className="col-type">Type</th>
              <th className="col-debit">Debit</th>
              <th className="col-credit">Credit</th>
              <th className="col-memo">Memo</th>
              <th className="col-status">Status</th>
            </tr>
          </thead>
          <tbody>
            {data?.entries.map((entry) => {
              const isExpanded = expandedEntries.has(entry.id) || showAllExpanded;
              
              return (
                <React.Fragment key={entry.id}>
                  {/* Entry Header Row */}
                  <tr className="entry-header-row" onClick={() => toggleEntry(entry.id)}>
                    <td className="col-id">{entry.id}</td>
                    <td className="col-date">
                      <div className="date-cell">
                        <div className="date">{formatDate(entry.entryDate)}</div>
                        <div className="time">{formatTime(entry.entryDate)}</div>
                      </div>
                    </td>
                    <td className="col-ref">
                      <code className="entry-ref">{entry.entryRef}</code>
                    </td>
                    <td className="col-module">
                      <span className={`module-badge ${getModuleBadgeClass(entry.sourceModule)}`}>
                        {entry.sourceModule}
                      </span>
                    </td>
                    <td className="col-event">
                      <span className="event-type">{entry.eventType}</span>
                    </td>
                    <td className="col-event-ref">
                      <a href={`#/transaction/${entry.eventRef}`} className="event-ref-link">
                        {entry.eventRef}
                      </a>
                    </td>
                    <td className="col-account" colSpan={2}>
                      <span className="line-count">{entry.lines.length} lines</span>
                    </td>
                    <td className="col-debit"></td>
                    <td className="col-credit"></td>
                    <td className="col-memo"></td>
                    <td className="col-status">{getStatusBadge(entry.status)}</td>
                  </tr>

                  {/* Entry Lines (if expanded) */}
                  {isExpanded && entry.lines.map((line, idx) => (
                    <tr key={`${entry.id}-${idx}`} className="entry-line-row">
                      <td className="col-id"></td>
                      <td className="col-date"></td>
                      <td className="col-ref"></td>
                      <td className="col-module"></td>
                      <td className="col-event"></td>
                      <td className="col-event-ref"></td>
                      <td className="col-account">
                        <div className="account-cell">
                          <div className="account-code">{line.accountCode}</div>
                          <div className="account-name">{line.accountName}</div>
                        </div>
                      </td>
                      <td className="col-type">
                        <span className={`account-type account-type-${line.accountType.toLowerCase()}`}>
                          {getAccountTypeIcon(line.accountType)} {line.accountType}
                        </span>
                      </td>
                      <td className="col-debit">
                        {line.side === 'DEBIT' && (
                          <span className="amount amount-debit">{formatAmount(line.amountUgx)}</span>
                        )}
                      </td>
                      <td className="col-credit">
                        {line.side === 'CREDIT' && (
                          <span className="amount amount-credit">{formatAmount(line.amountUgx)}</span>
                        )}
                      </td>
                      <td className="col-memo">
                        <span className="memo-text">{line.memo}</span>
                      </td>
                      <td className="col-status"></td>
                    </tr>
                  ))}

                  {/* Entry Summary Row */}
                  {isExpanded && (
                    <tr className="entry-summary-row">
                      <td colSpan={8}></td>
                      <td className="col-debit">
                        <strong>{formatAmount(entry.totalDebits)}</strong>
                      </td>
                      <td className="col-credit">
                        <strong>{formatAmount(entry.totalCredits)}</strong>
                      </td>
                      <td className="col-memo">
                        {entry.isBalanced ? (
                          <span className="balance-check balanced">✓ Balanced</span>
                        ) : (
                          <span className="balance-check imbalanced">⚠️ Imbalanced</span>
                        )}
                      </td>
                      <td></td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Section */}
      <div className="ledger-summary">
        <div className="summary-row">
          <span className="summary-label">Page Totals:</span>
          <span className="summary-value">
            Debits: UGX {formatAmount(data?.entries.reduce((sum, e) => sum + e.totalDebits, 0) || 0)}
          </span>
          <span className="summary-value">
            Credits: UGX {formatAmount(data?.entries.reduce((sum, e) => sum + e.totalCredits, 0) || 0)}
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Grand Totals:</span>
          <span className="summary-value">Debits: UGX {formatAmount(data?.summary.totalDebits || 0)}</span>
          <span className="summary-value">Credits: UGX {formatAmount(data?.summary.totalCredits || 0)}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Variance:</span>
          <span className={`summary-value ${isBalanced ? 'balanced' : 'imbalanced'}`}>
            {isBalanced ? '0 UGX ✓ Perfect Balance' : `UGX ${formatAmount(Math.abs(data?.summary.variance || 0))} ⚠️`}
          </span>
        </div>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="btn-page"
        >
          ‹ Previous
        </button>
        
        <div className="page-numbers">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = i + 1;
            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`btn-page ${currentPage === pageNum ? 'active' : ''}`}
              >
                {pageNum}
              </button>
            );
          })}
          {totalPages > 5 && <span>...</span>}
          {totalPages > 5 && (
            <button
              onClick={() => setCurrentPage(totalPages)}
              className={`btn-page ${currentPage === totalPages ? 'active' : ''}`}
            >
              {totalPages}
            </button>
          )}
        </div>

        <button
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="btn-page"
        >
          Next ›
        </button>
      </div>

      {/* Dead Letter Queue */}
      {failures.length > 0 && (
        <div className="failures-section">
          <div
            className="failures-header"
            onClick={() => setShowFailures(!showFailures)}
          >
            <span>⚠️ Dead-letter Queue ({failures.length} pending failures)</span>
            <button className="btn-toggle-failures">
              {showFailures ? '▲ Hide' : '▼ Show Details'}
            </button>
          </div>

          {showFailures && (
            <div className="failures-table-container">
              <table className="failures-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Module</th>
                    <th>Event</th>
                    <th>Event Ref</th>
                    <th>Error</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {failures.map((failure) => (
                    <tr key={failure.id}>
                      <td>{failure.id}</td>
                      <td>
                        <span className={`module-badge ${getModuleBadgeClass(failure.sourceModule)}`}>
                          {failure.sourceModule}
                        </span>
                      </td>
                      <td>{failure.eventType}</td>
                      <td><code>{failure.eventRef}</code></td>
                      <td className="error-message">{failure.errorMessage}</td>
                      <td>{formatDate(failure.createdAt)}</td>
                      <td>
                        <button
                          onClick={() => retryFailure(failure.id)}
                          className="btn-retry"
                        >
                          Retry
                        </button>
                        <button
                          onClick={() => dismissFailure(failure.id)}
                          className="btn-dismiss"
                        >
                          Dismiss
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountingLedger;

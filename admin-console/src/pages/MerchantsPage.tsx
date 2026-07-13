import { useState } from 'react'
import { Search, Plus, MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useMerchants } from '../hooks/useMerchants'

const MERCHANTS = [
  { id: 'MER-001', name: 'Kampala Grill',   owner: 'James Okello',   type: 'Restaurant', plan: 'Pro',   orders: 1240, revenue: 'UGX 22.4M', status: 'active',    joined: '12 Jan 2024' },
  { id: 'MER-002', name: 'City Lounge',     owner: 'Aisha Nakato',   type: 'Bar',        plan: 'Pro',   orders: 980,  revenue: 'UGX 18.1M', status: 'active',    joined: '3 Feb 2024'  },
  { id: 'MER-003', name: 'Nile Cafe',       owner: 'Peter Ssempa',   type: 'Restaurant', plan: 'Basic', orders: 741,  revenue: 'UGX 11.2M', status: 'active',    joined: '19 Feb 2024' },
  { id: 'MER-004', name: 'Pearl Events',    owner: 'Grace Nambi',    type: 'Events',     plan: 'Pro',   orders: 580,  revenue: 'UGX 9.6M',  status: 'warning',   joined: '5 Mar 2024'  },
  { id: 'MER-005', name: 'Garden Bistro',   owner: 'David Mwesige',  type: 'Restaurant', plan: 'Basic', orders: 430,  revenue: 'UGX 7.1M',  status: 'active',    joined: '14 Mar 2024' },
  { id: 'MER-006', name: 'Sky Bar',         owner: 'Rose Atuhaire',  type: 'Bar',        plan: 'Pro',   orders: 390,  revenue: 'UGX 6.4M',  status: 'suspended', joined: '22 Apr 2024' },
  { id: 'MER-007', name: 'Ugandan Kitchen', owner: 'Sam Byaruhanga', type: 'Restaurant', plan: 'Basic', orders: 210,  revenue: 'UGX 3.8M',  status: 'active',    joined: '1 May 2024'  },
  { id: 'MER-008', name: 'Fusion Hub',      owner: 'Mary Nalwoga',   type: 'Restaurant', plan: 'Basic', orders: 124,  revenue: 'UGX 2.1M',  status: 'pending',   joined: '15 Jun 2024' },
]

const STATUS_STYLE: Record<string, string> = {
  active:    'bg-emerald-50 text-emerald-700',
  warning:   'bg-amber-50 text-amber-700',
  suspended: 'bg-red-50 text-red-600',
  pending:   'bg-muted text-muted-foreground',
}

function currency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function MerchantsPage() {
  const { merchants, loading, error } = useMerchants()
  const [query, setQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: 'Restaurant' as 'Restaurant' | 'Bar' | 'School' | 'Boutique',
    email: '',
    phoneNumber: '',
    paymentType: 'MOBILE_MONEY' as 'MOBILE_MONEY' | 'BANK_ACCOUNT',
    // Mobile Money
    mobileProvider: 'MTN',
    mobileNumber: '',
    // Bank
    bankName: '',
    bankAccountNumber: '',
    termsAccepted: true,
  })

  const resetForm = () => {
    setFormData({
      businessName: '',
      businessType: 'Restaurant',
      email: '',
      phoneNumber: '',
      paymentType: 'MOBILE_MONEY',
      mobileProvider: 'MTN',
      mobileNumber: '',
      bankName: '',
      bankAccountNumber: '',
      termsAccepted: true,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const paymentDestination = formData.paymentType === 'MOBILE_MONEY'
        ? {
            type: 'MOBILE_MONEY',
            provider: formData.mobileProvider,
            number: formData.mobileNumber,
            accountName: formData.businessName,
          }
        : {
            type: 'BANK_ACCOUNT',
            bankName: formData.bankName,
            bankAccountNumber: formData.bankAccountNumber,
          }

      const response = await fetch('http://localhost:4000/api/auth/merchant/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: formData.businessName,
          businessType: formData.businessType,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          paymentDestination,
          termsAccepted: formData.termsAccepted,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Registration failed')
      }

      toast.success('Merchant created successfully! Verification email sent.')
      setShowAddDialog(false)
      resetForm()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create merchant')
    } finally {
      setSubmitting(false)
    }
  }

  // Use API data if available, fallback to static data
  const displayMerchants = merchants.length > 0 ? merchants.map(m => ({
    id: m.id,
    name: m.name,
    owner: m.owner,
    type: m.type,
    plan: m.plan,
    orders: m.orders,
    revenue: currency(m.revenue),
    status: m.status,
    joined: new Date(m.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  })) : MERCHANTS

  const filtered = displayMerchants.filter((m) =>
    [m.name, m.owner, m.type, m.id].join(' ').toLowerCase().includes(query.toLowerCase())
  )

  const totalMerchants = displayMerchants.length
  const activeMerchants = displayMerchants.filter(m => m.status === 'active').length
  const pendingMerchants = displayMerchants.filter(m => m.status === 'pending').length
  const suspendedMerchants = displayMerchants.filter(m => m.status === 'suspended').length

  return (
    <>
      {/* Show error/loading banner if needed */}
      {error && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', background: 'oklch(0.96 0.02 30 / 0.15)', border: '1px solid oklch(0.577 0.245 27.325 / 0.4)', borderRadius: '10px', color: 'oklch(0.577 0.245 27.325)', fontSize: '13px', fontWeight: '500' }}>
          ⚠️ Could not load live data. Showing fallback data.
        </div>
      )}
      {loading && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', background: 'oklch(0.95 0.01 250 / 0.15)', border: '1px solid oklch(0.60 0.15 250 / 0.4)', borderRadius: '10px', color: 'oklch(0.50 0.15 250)', fontSize: '13px', fontWeight: '500' }}>
          🔄 Loading live data...
        </div>
      )}
      {/* Summary cards */}
      <div className="admin-metric-grid">
        {[
          { label: 'Total',     value: totalMerchants.toString(), sub: 'All time' },
          { label: 'Active',    value: activeMerchants.toString(), sub: 'Currently live' },
          { label: 'Pending',   value: pendingMerchants.toString(),   sub: 'Awaiting approval' },
          { label: 'Suspended', value: suspendedMerchants.toString(),   sub: 'Violations / issues' },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label} Merchants</span>
            <span className="metric-value">{c.value}</span>
            <span className="metric-sub">{c.sub}</span>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div><h3>All Merchants</h3><p>{filtered.length} of {displayMerchants.length} shown</p></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search merchants…" className="h-8 pl-8 w-56 text-sm" />
            </div>
            <Button size="sm" className="h-8" onClick={() => setShowAddDialog(true)}><Plus size={13} />Add merchant</Button>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['ID', 'Merchant', 'Owner', 'Type', 'Plan', 'Orders', 'Revenue', 'Status', 'Joined', ''].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted-foreground)' }}>{m.id}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--foreground)' }}>{m.name}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{m.owner}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{m.type}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge variant="secondary" className={m.plan === 'Pro' ? 'bg-primary/10 text-primary' : ''}>
                      {m.plan}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{m.orders.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{m.revenue}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge variant="secondary" className={STATUS_STYLE[m.status]}>
                      {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{m.joined}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Button variant="ghost" size="icon-sm"><MoreHorizontal size={14} /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Merchant Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Merchant</DialogTitle>
            <DialogDescription>
              Create a new merchant account. The user will receive an email verification link to set their password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Business Name */}
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name *</Label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                placeholder="e.g., Brew House Café"
                required
              />
            </div>

            {/* Business Type */}
            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type *</Label>
              <Select
                value={formData.businessType}
                onValueChange={(value: any) => setFormData({ ...formData, businessType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Restaurant">Restaurant</SelectItem>
                  <SelectItem value="Bar">Bar</SelectItem>
                  <SelectItem value="School">School</SelectItem>
                  <SelectItem value="Boutique">Boutique</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Email & Phone in a grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number *</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="+256 700 000 000"
                  required
                />
              </div>
            </div>

            {/* Payment Type */}
            <div className="space-y-2">
              <Label htmlFor="paymentType">Payment Method *</Label>
              <Select
                value={formData.paymentType}
                onValueChange={(value: any) => setFormData({ ...formData, paymentType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                  <SelectItem value="BANK_ACCOUNT">Bank Account</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mobile Money Fields */}
            {formData.paymentType === 'MOBILE_MONEY' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mobileProvider">Provider *</Label>
                  <Select
                    value={formData.mobileProvider}
                    onValueChange={(value: any) => setFormData({ ...formData, mobileProvider: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                      <SelectItem value="AIRTEL">Airtel Money</SelectItem>
                      <SelectItem value="AFRICELL">Africell Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mobileNumber">Mobile Number *</Label>
                  <Input
                    id="mobileNumber"
                    type="tel"
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                    placeholder="+256 700 000 000"
                    required
                  />
                </div>
              </div>
            )}

            {/* Bank Account Fields */}
            {formData.paymentType === 'BANK_ACCOUNT' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name *</Label>
                  <Input
                    id="bankName"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="e.g., Stanbic Bank"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankAccountNumber">Account Number *</Label>
                  <Input
                    id="bankAccountNumber"
                    value={formData.bankAccountNumber}
                    onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                    placeholder="Account number"
                    required
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false)
                  resetForm()
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Merchant'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

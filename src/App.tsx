import { type CSSProperties, type FormEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Clock, DollarSign, MoreHorizontal, ShoppingCart, Trash2, X } from 'lucide-react'
import QRCode from 'qrcode'
import './App.css'

const ORDERS_KEY = 'scanit-orders-v1'
const BUSINESSES_KEY = 'scanit-businesses-v2'
const SCAN_BASE_URL = 'https://scanit.app'
const REQUIRED_FIELD_MESSAGE = 'Please fill out this field.'

type BusinessType = 'Restaurant' | 'Bar' | 'School' | 'Boutique'

type CatalogItem = {
  id: string
  name: string
  category: string
  price: number
  description: string
  available: boolean
}

type Business = {
  id: string
  merchantId: string
  qrToken: string
  name: string
  ownerName: string
  phone: string
  type: BusinessType
  tableLabel: string
  paymentReference: string
  accent: string
  items: CatalogItem[]
}

type CartLine = CatalogItem & {
  quantity: number
  lineTotal: number
}

type Order = {
  id: string
  businessId: string
  merchantId: string
  qrToken: string
  paymentReference: string
  businessName: string
  customer: {
    name: string
    phone: string
    location: string
    note: string
  }
  items: Array<Pick<CatalogItem, 'id' | 'name' | 'price'> & { quantity: number; lineTotal: number }>
  total: number
  paymentStatus: 'Unpaid' | 'Paid' | 'Refunded'
  status: 'Pending' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled'
  createdAt: string
}

type Customer = Order['customer']

type QrStyle = CSSProperties & {
  '--accent': string
}

const defaultBusinesses: Business[] = [
  {
    id: 'kampala-grill',
    merchantId: 'MER-KGL-1001',
    qrToken: 'SIT-KGL-1001',
    name: 'ScanIT Business',
    ownerName: '',
    phone: '',
    type: 'Bar',
    tableLabel: 'Location',
    paymentReference: '',
    accent: '#2563eb',
    items: [
      {
        id: 'beef-plate',
        name: 'Beef Plate',
        category: 'Meals',
        price: 18000,
        description: 'Grilled beef, rice, greens, and house sauce.',
        available: true,
      },
      {
        id: 'chicken-wrap',
        name: 'Chicken Wrap',
        category: 'Meals',
        price: 14500,
        description: 'Soft wrap with chicken, salad, and garlic sauce.',
        available: true,
      },
      {
        id: 'passion-juice',
        name: 'Passion Juice',
        category: 'Drinks',
        price: 6000,
        description: 'Fresh passion fruit juice served cold.',
        available: true,
      },
      {
        id: 'family-platter',
        name: 'Family Platter',
        category: 'Meals',
        price: 42000,
        description: 'Mixed grill, fries, salad, and two sauces.',
        available: false,
      },
    ],
  },
  {
    id: 'city-lounge',
    merchantId: 'MER-CLG-1002',
    qrToken: 'SIT-CLG-1002',
    name: 'City Lounge',
    ownerName: '',
    phone: '',
    type: 'Bar',
    tableLabel: 'Seat or area',
    paymentReference: 'PAY-CLG-1002',
    accent: '#7c3aed',
    items: [
      {
        id: 'mocktail',
        name: 'House Mocktail',
        category: 'Drinks',
        price: 12000,
        description: 'Citrus, mint, soda, and crushed ice.',
        available: true,
      },
      {
        id: 'wings',
        name: 'Spicy Wings',
        category: 'Bites',
        price: 22000,
        description: 'Six wings with chilli glaze and dip.',
        available: true,
      },
      {
        id: 'vip-ticket',
        name: 'Friday VIP Ticket',
        category: 'Tickets',
        price: 30000,
        description: 'Entry ticket for Friday night live DJ event.',
        available: true,
      },
    ],
  },
]

function currency(amount) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

function customerUrl(business: Business) {
  return `${SCAN_BASE_URL}/b/${business.id}?qr=${business.qrToken}`
}

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function App() {
  const [businesses, setBusinesses] = useState(() => readJson(BUSINESSES_KEY, defaultBusinesses))
  const [activeBusinessId] = useState(() => businesses[0]?.id ?? '')
  const [view, setView] = useState('account')
  const [orders, setOrders] = useState<Order[]>(() => readJson<Order[]>(ORDERS_KEY, []))
  const [cart, setCart] = useState<Record<string, number>>({})
  const [customer, setCustomer] = useState<Customer>({
    name: '',
    phone: '',
    location: '',
    note: '',
  })

  const business = businesses.find((entry) => entry.id === activeBusinessId) ?? businesses[0]
  const categories = [...new Set(business.items.map((item) => item.category))]

  const cartLines = useMemo<CartLine[]>(() => {
    return Object.entries(cart)
      .map(([itemId, quantity]) => {
        const item = business.items.find((entry) => entry.id === itemId)
        return item ? { ...item, quantity, lineTotal: item.price * quantity } : null
      })
      .filter((item): item is CartLine => Boolean(item))
  }, [business.items, cart])

  const total = cartLines.reduce((sum, item) => sum + item.lineTotal, 0)
  const businessOrders = orders.filter((order) => order.businessId === business.id)
  const pendingCount = businessOrders.filter(
    (order) => order.status !== 'Completed' && order.status !== 'Cancelled',
  ).length
  const paidTotal = businessOrders
    .filter((order) => order.paymentStatus === 'Paid')
    .reduce((sum, order) => sum + order.total, 0)
  const availableItems = business.items.filter((item) => item.available).length

  useEffect(() => {
    localStorage.setItem(BUSINESSES_KEY, JSON.stringify(businesses))
  }, [businesses])

  useEffect(() => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
  }, [orders])

  function updateBusinessItems(nextItems) {
    setBusinesses((current) =>
      current.map((entry) => (entry.id === business.id ? { ...entry, items: nextItems } : entry)),
    )
  }

  function addToCart(item) {
    if (!item.available) return
    setCart((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 }))
  }

  function updateQuantity(itemId, quantity) {
    setCart((current) => {
      const next = { ...current }
      if (quantity <= 0) {
        delete next[itemId]
      } else {
        next[itemId] = quantity
      }
      return next
    })
  }

  function submitOrder(event) {
    event.preventDefault()
    if (!cartLines.length || !customer.name.trim()) return

    const order: Order = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      businessId: business.id,
      merchantId: business.merchantId,
      qrToken: business.qrToken,
      paymentReference: business.paymentReference,
      businessName: business.name,
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        location: customer.location.trim(),
        note: customer.note.trim(),
      },
      items: cartLines.map(({ id, name, price, quantity, lineTotal }) => ({
        id,
        name,
        price,
        quantity,
        lineTotal,
      })),
      total,
      paymentStatus: 'Unpaid',
      status: 'Pending',
      createdAt: new Date().toISOString(),
    }

    setOrders((current) => [order, ...current])
    setCart({})
    setCustomer({ name: '', phone: '', location: '', note: '' })
    setView('dashboard')
  }

  function updateStatus(orderId, status) {
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, status } : order)),
    )
  }

  function updatePayment(orderId, paymentStatus) {
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, paymentStatus } : order)),
    )
  }

  function clearCompleted() {
    setOrders((current) =>
      current.filter(
        (order) =>
          order.businessId !== business.id ||
          (order.status !== 'Completed' && order.status !== 'Cancelled'),
      ),
    )
  }

  return (
    <main className="company-shell">
      <aside className="company-sidebar" aria-label="Company workspace navigation">
        <div>
          <p className="eyebrow">ScanIT</p>
          <h1>{business.name}</h1>
          <p className="sidebar-copy">Your company workspace is ready. Print your QR and start receiving orders.</p>
        </div>

        <div className="company-status">
          <span>Registered company</span>
          <strong>{business.type}</strong>
        </div>

        <nav className="side-nav" aria-label="Workspace sections">
          {[
            ['account', 'Overview'],
            ['catalog', 'Catalog'],
            ['dashboard', `Orders${pendingCount ? ` (${pendingCount})` : ''}`],
          ].map(([id, label]) => (
            <button
              type="button"
              className={view === id ? 'active' : ''}
              key={id}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <QrPanel business={business} compact />
      </aside>

      <section className="company-workspace">
        <header className="company-topbar">
          <div>
            <p className="eyebrow">Company dashboard</p>
            <h2>
              {view === 'account' && 'Overview'}
              {view === 'catalog' && 'Catalog'}
              {view === 'add-item' && 'Add Item'}
              {view === 'dashboard' && 'Orders'}
            </h2>
            <p>
              {view === 'account' && 'Manage QR access, catalog items, orders, and payments from one workspace.'}
              {view === 'catalog' && 'Manage your catalog items, prices, and availability.'}
              {view === 'add-item' && 'Add a new item, service, or ticket to your catalog.'}
              {view === 'dashboard' && 'Track and manage all orders in real-time.'}
            </p>
          </div>
          {view === 'account' && (
            <button className="primary-action topbar-add-item-button" type="button" onClick={() => setView('add-item')}>
              Add item
            </button>
          )}
        </header>

        {view === 'account' && (
          <>
            <section className="metric-grid overview-metric-grid" aria-label="Overview summary">
              <div>
                <span>Open orders</span>
                <strong>{pendingCount}</strong>
              </div>
              <div>
                <span>Published items</span>
                <strong>{availableItems}</strong>
              </div>
              <div>
                <span>Paid sales</span>
                <strong>{currency(paidTotal)}</strong>
              </div>
            </section>
            <OverviewPage business={business} />
          </>
        )}

        {view === 'add-item' && (
          <AddItemPage
            business={business}
            onBack={() => setView('catalog')}
            onItemsChange={(items) => {
              updateBusinessItems(items)
              setView('catalog')
            }}
          />
        )}

        {view === 'catalog' && (
          <CatalogPage business={business} onItemsChange={updateBusinessItems} onAddItem={() => setView('add-item')} />
        )}

        {view === 'dashboard' && (
          <Dashboard
            business={business}
            orders={businessOrders}
            onClearCompleted={clearCompleted}
            onPaymentChange={updatePayment}
            onStatusChange={updateStatus}
          />
        )}
      </section>
    </main>
  )
}

function OverviewPage({ business }: { business: Business }) {
  return (
    <div className="account-layout">
      <MetricsCard business={business} />

      <section className="account-summary">
        <QrPanel business={business} />

        <div className="link-map">
          <h3>What customers access</h3>
          <div>
            <span>Customer menu</span>
            <strong>{customerUrl(business)}</strong>
          </div>
          <div>
            <span>Orders</span>
            <strong>{business.merchantId}</strong>
          </div>
          <div>
            <span>Goods and prices</span>
            <strong>{business.items.length} linked items</strong>
          </div>
        </div>
      </section>
    </div>
  )
}

function MetricsCard({ business }: { business: Business }) {
  const metricData = {
    day: {
      label: '1D',
      scansTotal: '148',
      ordersTotal: '32',
      yLabels: ['200', '150', '100', '50', '0'],
      xLabels: ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM'],
      points: [
        { label: '8 AM', scans: 34, orders: 4, x: 64, y: 176 },
        { label: '10 AM', scans: 52, orders: 7, x: 154, y: 138 },
        { label: '12 PM', scans: 66, orders: 10, x: 252, y: 112 },
        { label: '2 PM', scans: 48, orders: 6, x: 348, y: 152 },
        { label: '4 PM', scans: 74, orders: 12, x: 452, y: 96 },
        { label: '6 PM', scans: 89, orders: 18, x: 570, y: 78 },
        { label: '8 PM', scans: 61, orders: 9, x: 696, y: 126 },
      ],
      areaPath: 'M0 190 C70 165 115 118 170 142 C236 170 268 91 336 128 C412 168 436 74 520 92 C612 112 660 78 760 118 L760 260 L0 260 Z',
      scansPath: 'M0 184 C70 160 112 116 170 136 C236 164 270 86 336 122 C414 162 438 70 520 86 C612 105 662 72 760 112',
      ordersPath: 'M0 210 C86 180 118 164 174 172 C246 184 286 128 344 154 C420 188 460 116 532 124 C620 136 660 104 760 130',
    },
    week: {
      label: '1W',
      scansTotal: '38h',
      ordersTotal: '80h',
      yLabels: ['40k', '30k', '20k', '10k', '0'],
      xLabels: ['13 Oct', '15 Oct', '17 Oct', '19 Oct', '21 Oct', '23 Oct', '25 Oct', '27 Oct', '29 Oct'],
      points: [
        { label: '13 Oct', scans: 21, orders: 24, x: 82, y: 166 },
        { label: '15 Oct', scans: 26, orders: 27, x: 156, y: 132 },
        { label: '17 Oct', scans: 28, orders: 25, x: 220, y: 104 },
        { label: '19 Oct', scans: 21, orders: 23, x: 300, y: 158 },
        { label: '21 Oct', scans: 25, orders: 22, x: 386, y: 132 },
        { label: '23 Oct', scans: 24, orders: 30, x: 446, y: 140 },
        { label: '25 Oct', scans: 27, orders: 31, x: 540, y: 116 },
        { label: '27 Oct', scans: 26, orders: 24, x: 650, y: 136 },
        { label: '29 Oct', scans: 30, orders: 28, x: 738, y: 112 },
      ],
      areaPath: 'M0 170 C70 115 105 92 160 112 C230 138 225 198 300 162 C362 132 390 178 448 145 C512 108 565 105 612 138 C665 176 690 105 760 118 L760 260 L0 260 Z',
      scansPath: 'M0 166 C60 116 100 82 154 104 C232 136 222 196 300 158 C362 127 389 176 448 140 C515 100 565 102 616 134 C670 169 696 101 760 112',
      ordersPath: 'M0 120 C62 156 105 122 145 92 C190 60 216 138 274 150 C326 160 348 92 395 126 C456 170 495 86 545 112 C590 140 606 194 662 148 C706 111 724 96 760 108',
    },
    month: {
      label: '1M',
      scansTotal: '12.8k',
      ordersTotal: '2.4k',
      yLabels: ['16k', '12k', '8k', '4k', '0'],
      xLabels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
      points: [
        { label: 'Week 1', scans: 8.2, orders: 1.2, x: 70, y: 160 },
        { label: 'Week 2', scans: 10.4, orders: 1.8, x: 210, y: 118 },
        { label: 'Week 3', scans: 7.9, orders: 1.5, x: 360, y: 170 },
        { label: 'Week 4', scans: 12.8, orders: 2.4, x: 520, y: 86 },
        { label: 'Week 5', scans: 11.1, orders: 2.1, x: 690, y: 112 },
      ],
      areaPath: 'M0 180 C95 154 132 108 216 118 C304 128 328 192 418 154 C504 118 520 72 612 92 C690 108 720 126 760 104 L760 260 L0 260 Z',
      scansPath: 'M0 176 C96 150 134 102 216 112 C304 122 330 188 418 150 C504 112 522 66 612 86 C690 102 722 120 760 98',
      ordersPath: 'M0 208 C92 178 148 158 228 166 C310 174 342 142 420 154 C500 166 542 116 620 124 C690 132 720 110 760 116',
    },
    year: {
      label: '1Y',
      scansTotal: '104k',
      ordersTotal: '19k',
      yLabels: ['120k', '90k', '60k', '30k', '0'],
      xLabels: ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'],
      points: [
        { label: 'Jan', scans: 42, orders: 7, x: 46, y: 184 },
        { label: 'Feb', scans: 50, orders: 8, x: 112, y: 168 },
        { label: 'Mar', scans: 61, orders: 10, x: 180, y: 142 },
        { label: 'Apr', scans: 58, orders: 9, x: 246, y: 150 },
        { label: 'May', scans: 74, orders: 12, x: 316, y: 118 },
        { label: 'Jun', scans: 80, orders: 14, x: 386, y: 102 },
        { label: 'Jul', scans: 76, orders: 13, x: 456, y: 112 },
        { label: 'Aug', scans: 92, orders: 16, x: 526, y: 82 },
        { label: 'Sep', scans: 88, orders: 15, x: 596, y: 94 },
        { label: 'Oct', scans: 104, orders: 19, x: 666, y: 64 },
        { label: 'Nov', scans: 97, orders: 18, x: 724, y: 78 },
      ],
      areaPath: 'M0 204 C76 190 108 156 176 148 C244 140 270 114 336 120 C418 128 438 82 510 96 C580 110 624 56 690 72 C728 82 744 70 760 66 L760 260 L0 260 Z',
      scansPath: 'M0 198 C76 184 108 150 176 142 C244 134 270 108 336 114 C418 122 438 76 510 90 C580 104 624 50 690 66 C728 76 744 64 760 60',
      ordersPath: 'M0 220 C76 204 120 188 184 184 C260 178 294 156 354 164 C430 174 458 136 528 146 C592 156 636 112 704 124 C732 130 746 118 760 114',
    },
  }
  const [range, setRange] = useState<keyof typeof metricData>('week')
  const data = metricData[range]
  const [activeIndex, setActiveIndex] = useState(5)
  const activePoint = data.points[Math.min(activeIndex, data.points.length - 1)]

  function updateActivePoint(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const cursorX = ((event.clientX - bounds.left) / bounds.width) * 760
    const nextIndex = data.points.reduce((closestIndex, point, index) =>
      Math.abs(point.x - cursorX) < Math.abs(data.points[closestIndex].x - cursorX) ? index : closestIndex,
    0)

    setActiveIndex(nextIndex)
  }

  function selectRange(nextRange: keyof typeof metricData) {
    setRange(nextRange)
    setActiveIndex(Math.floor(metricData[nextRange].points.length / 2))
  }

  return (
    <section className="metrics-card" aria-label="QR activity metrics">
      <div className="metrics-head">
        <div>
          <p>QR activity and order readiness</p>
          <div className="metric-legend">
            <span className="new-dot"></span>
            <strong>Scans</strong>
            <b>{data.scansTotal}</b>
            <span className="resolved-dot"></span>
            <strong>Orders</strong>
            <b>{data.ordersTotal}</b>
          </div>
        </div>
        <div className="range-tabs" aria-label="Metric range">
          {Object.entries(metricData).map(([key, value]) => (
            <button
              className={range === key ? 'active' : ''}
              key={key}
              type="button"
              onClick={() => selectRange(key as keyof typeof metricData)}
            >
              {value.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-wrap">
        <div className="chart-y">
          {data.yLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <svg
          className="metrics-chart"
          viewBox="0 0 760 260"
          role="img"
          aria-label={`${business.name} QR scan and order trend`}
          onPointerMove={updateActivePoint}
          onPointerLeave={() => setActiveIndex(Math.floor(data.points.length / 2))}
        >
          <defs>
            <linearGradient id="scan-fill" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#98c99a" stopOpacity="0.38" />
              <stop offset="55%" stopColor="#d5b181" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#1f2937" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="scan-line" x1="0" x2="1">
              <stop offset="0%" stopColor="#d7e8c5" />
              <stop offset="100%" stopColor="#84b486" />
            </linearGradient>
            <linearGradient id="order-line" x1="0" x2="1">
              <stop offset="0%" stopColor="#d5b181" />
              <stop offset="100%" stopColor="#e7c899" />
            </linearGradient>
          </defs>
          <path
            className="chart-area"
            d={data.areaPath}
          />
          <path
            className="chart-line primary"
            d={data.scansPath}
          />
          <path
            className="chart-line secondary"
            d={data.ordersPath}
          />
          <line className="chart-marker" x1={activePoint.x} x2={activePoint.x} y1="20" y2="238" />
          <circle className="chart-point" cx={activePoint.x} cy={activePoint.y} r="5" />
          <g className="chart-tooltip">
            <rect x={Math.min(activePoint.x + 12, 648)} y="42" width="100" height="64" rx="6" />
            <text x={Math.min(activePoint.x + 26, 662)} y="63">{activePoint.label}</text>
            <text x={Math.min(activePoint.x + 26, 662)} y="81">{activePoint.scans}k scans</text>
            <text x={Math.min(activePoint.x + 26, 662)} y="97">{activePoint.orders} orders</text>
          </g>
        </svg>
        <div className="chart-x">
          {data.xLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

function QrPanel({ business, compact = false }: { business: Business; compact?: boolean }) {
  const [qrImage, setQrImage] = useState('')
  const url = customerUrl(business)

  useEffect(() => {
    let cancelled = false

    QRCode.toDataURL(url, {
      color: {
        dark: '#18211f',
        light: '#ffffff',
      },
      margin: 1,
      width: compact ? 110 : 220,
    }).then((image) => {
      if (!cancelled) setQrImage(image)
    })

    return () => {
      cancelled = true
    }
  }, [business.id, compact, url])

  return (
    <div className={compact ? 'qr-panel compact' : 'qr-panel large'} style={{ '--accent': business.accent } as QrStyle}>
      <div className="print-card">
        <div className="print-brand">ScanIT</div>
        <h3>{business.name}</h3>
        <p>Scan to view prices, goods, tickets, and place orders.</p>
        {qrImage ? <img src={qrImage} alt={`${business.name} QR code`} /> : <div className="qr-loading" />}
        <strong>{url}</strong>
      </div>

      <div className="qr-details">
        <strong>{compact ? 'Customer link' : 'Auto-generated QR'}</strong>
        <p>{url}</p>
        {!compact && (
          <>
            <dl>
              <div>
                <dt>Merchant ID</dt>
                <dd>{business.merchantId}</dd>
              </div>
              <div>
                <dt>QR token</dt>
                <dd>{business.qrToken}</dd>
              </div>
            </dl>
            <div className="qr-actions">
              <button type="button" onClick={() => window.print()}>
                Print QR
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function CustomerMenu({
  business,
  categories,
  cartLines,
  customer,
  total,
  onAdd,
  onCustomerChange,
  onQuantityChange,
  onSubmit,
}: {
  business: Business
  categories: string[]
  cartLines: CartLine[]
  customer: Customer
  total: number
  onAdd: (item: CatalogItem) => void
  onCustomerChange: (customer: Customer) => void
  onQuantityChange: (itemId: string, quantity: number) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const [submitted, setSubmitted] = useState(false)
  const isCustomerNameMissing = submitted && !customer.name.trim()

  function submitOrderForm(event) {
    setSubmitted(true)

    if (!customer.name.trim()) {
      event.preventDefault()
      return
    }

    onSubmit(event)
  }

  return (
    <div className="customer-layout">
      <section className="menu-panel">
        {categories.map((category) => (
          <div className="menu-section" key={category}>
            <div className="section-heading">
              <h3>{category}</h3>
              <span>
                {business.items.filter((item) => item.category === category && item.available).length}{' '}
                available
              </span>
            </div>

            <div className="item-grid">
              {business.items
                .filter((item) => item.category === category)
                .map((item) => (
                  <article className={item.available ? 'item-card' : 'item-card muted'} key={item.id}>
                    <div>
                      <h4>{item.name}</h4>
                      <p>{item.description}</p>
                    </div>
                    <div className="item-action">
                      <strong>{currency(item.price)}</strong>
                      <button type="button" disabled={!item.available} onClick={() => onAdd(item)}>
                        {item.available ? 'Add' : 'Out'}
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          </div>
        ))}
      </section>

      <aside className="cart-panel">
        <div className="cart-header">
          <h3>Your order</h3>
          <span>{cartLines.length} items</span>
        </div>

        {cartLines.length ? (
          <div className="cart-lines">
            {cartLines.map((item) => (
              <div className="cart-line" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{currency(item.lineTotal)}</span>
                </div>
                <div className="stepper">
                  <button type="button" onClick={() => onQuantityChange(item.id, item.quantity - 1)}>
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button type="button" onClick={() => onQuantityChange(item.id, item.quantity + 1)}>
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">Add menu items or tickets to start an order.</p>
        )}

        <form className="order-form" noValidate onSubmit={submitOrderForm}>
          <label>
            Name
            <input
              required
              aria-invalid={isCustomerNameMissing}
              className={isCustomerNameMissing ? 'field-error' : undefined}
              value={customer.name}
              onChange={(event) => onCustomerChange({ ...customer, name: event.target.value })}
              placeholder="Customer name"
            />
            {isCustomerNameMissing && <span className="field-error-message">{REQUIRED_FIELD_MESSAGE}</span>}
          </label>
          <label>
            {business.tableLabel}
            <input
              value={customer.location}
              onChange={(event) => onCustomerChange({ ...customer, location: event.target.value })}
              placeholder="Table 4, counter, gate..."
            />
          </label>
          <label>
            Note
            <textarea
              value={customer.note}
              onChange={(event) => onCustomerChange({ ...customer, note: event.target.value })}
              placeholder="No onions, pickup time, delivery note..."
            />
          </label>

          <div className="total-row">
            <span>Total</span>
            <strong>{currency(total)}</strong>
          </div>
          <button className="primary-action" type="submit" disabled={!cartLines.length}>
            Place order
          </button>
        </form>
      </aside>
    </div>
  )
}

function AddItemForm({
  business,
  onItemsChange,
}: {
  business: Business
  onItemsChange: (items: CatalogItem[]) => void
}) {
  const emptyItem = {
    name: '',
    category: '',
    price: '',
    description: '',
    available: true,
  }
  const [item, setItem] = useState(emptyItem)
  const [submitted, setSubmitted] = useState(false)
  const categories = [...new Set<string>(business.items.map((entry) => entry.category))]

  function submitItem(event) {
    event.preventDefault()

    const name = item.name.trim()
    const category = item.category.trim()
    const price = Number(item.price)

    setSubmitted(true)

    if (!name || !category || !Number.isFinite(price) || price <= 0) return

    const newItem = {
      id: `${business.id}-${Date.now()}`,
      name,
      category,
      price,
      description: item.description.trim() || 'No description added yet.',
      available: item.available,
    }

    onItemsChange([...business.items, newItem])
    setItem(emptyItem)
    setSubmitted(false)
  }

  const isItemNameMissing = submitted && !item.name.trim()
  const isCategoryMissing = submitted && !item.category.trim()
  const price = Number(item.price)
  const isPriceMissing = submitted && (!Number.isFinite(price) || price <= 0)

  return (
    <form className="catalog-form universal-item-form" noValidate onSubmit={submitItem}>
      <div>
        <p className="eyebrow">Add item</p>
        <h3>New item, service, or ticket</h3>
      </div>

      <label>
        Item or ticket name
        <input
          required
          aria-invalid={isItemNameMissing}
          className={isItemNameMissing ? 'field-error' : undefined}
          value={item.name}
          onChange={(event) => setItem({ ...item, name: event.target.value })}
          placeholder="Burger, cocktail, VIP ticket, uniform, school lunch..."
        />
        {isItemNameMissing && <span className="field-error-message">{REQUIRED_FIELD_MESSAGE}</span>}
      </label>

      <label>
        Category
        <input
          required
          aria-invalid={isCategoryMissing}
          className={isCategoryMissing ? 'field-error' : undefined}
          list="catalog-categories"
          value={item.category}
          onChange={(event) => setItem({ ...item, category: event.target.value })}
          placeholder="Meals, Drinks, Tickets, Services, Goods..."
        />
        {isCategoryMissing && <span className="field-error-message">{REQUIRED_FIELD_MESSAGE}</span>}
      </label>

      <datalist id="catalog-categories">
        {categories.map((category) => (
          <option value={category} key={category} />
        ))}
      </datalist>

      <label>
        Price
        <input
          required
          aria-invalid={isPriceMissing}
          className={isPriceMissing ? 'field-error' : undefined}
          min="1"
          type="number"
          value={item.price}
          onChange={(event) => setItem({ ...item, price: event.target.value })}
          placeholder="18000"
        />
        {isPriceMissing && <span className="field-error-message">{REQUIRED_FIELD_MESSAGE}</span>}
      </label>

      <label>
        Description
        <textarea
          value={item.description}
          onChange={(event) => setItem({ ...item, description: event.target.value })}
          placeholder="Size, flavor, seat type, pickup details, event date, or customer note"
        />
      </label>

      <label className="inline-check">
        <input
          checked={item.available}
          type="checkbox"
          onChange={(event) => setItem({ ...item, available: event.target.checked })}
        />
        Available to customers
      </label>

      <button className="primary-action" type="submit">
        Add item
      </button>
    </form>
  )
}
function AddItemPage({
  business,
  onBack,
  onItemsChange,
}: {
  business: Business
  onBack: () => void
  onItemsChange: (items: CatalogItem[]) => void
}) {
  return (
    <section className="add-item-page">
      <button className="icon-button add-item-back-button" type="button" onClick={onBack} aria-label="Back to overview" title="Back to overview">
        <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
      </button>

      <div className="dashboard-head add-item-head">
        <div>
          <p className="eyebrow">Add item</p>
          <h3>Add item</h3>
        </div>
      </div>

      <AddItemForm business={business} onItemsChange={onItemsChange} />
    </section>
  )
}

function CatalogPage({
  business,
  onItemsChange,
  onAddItem,
}: {
  business: Business
  onItemsChange: (items: CatalogItem[]) => void
  onAddItem: () => void
}) {
  const PAGE_SIZE = 20
  const categories = useMemo(() => [...new Set(business.items.map((i) => i.category))], [business.items])

  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<CatalogItem>>({})

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return business.items.filter((item) => {
      const matchSearch = !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
      const matchCategory = filterCategory === 'all' || item.category === filterCategory
      const matchStatus = filterStatus === 'all' || (filterStatus === 'available' ? item.available : !item.available)
      return matchSearch && matchCategory && matchStatus
    })
  }, [business.items, search, filterCategory, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function startEdit(item: CatalogItem) {
    setEditingId(item.id)
    setEditDraft({ ...item })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({})
  }

  function saveEdit() {
    if (!editDraft.name?.trim() || !editDraft.category?.trim()) return
    onItemsChange(
      business.items.map((entry) =>
        entry.id === editingId
          ? { ...entry, ...editDraft, price: Number(editDraft.price) || 0 }
          : entry,
      ),
    )
    cancelEdit()
  }

  function removeItem(itemId: string) {
    onItemsChange(business.items.filter((entry) => entry.id !== itemId))
    if (editingId === itemId) cancelEdit()
  }

  function resetFilters() {
    setSearch('')
    setFilterCategory('all')
    setFilterStatus('all')
    setPage(1)
  }

  const isFiltered = search || filterCategory !== 'all' || filterStatus !== 'all'

  return (
    <section className="catalog-page">
      <section className="metric-grid" aria-label="Catalog summary">
        <div>
          <span>Total items</span>
          <strong>{business.items.length}</strong>
        </div>
        <div>
          <span>Available</span>
          <strong>{business.items.filter(i => i.available).length}</strong>
        </div>
        <div>
          <span>Hidden</span>
          <strong>{business.items.filter(i => !i.available).length}</strong>
        </div>
        <div>
          <span>Categories</span>
          <strong>{categories.length}</strong>
        </div>
      </section>
      <div className="dashboard-head">
        <div>
          <p className="eyebrow">Catalog</p>
          <h3>Items customers see after scanning</h3>
        </div>
        <div className="catalog-head-actions">
          <span className="catalog-count">{business.items.length} items</span>
          <button className="primary-action catalog-add-btn" type="button" onClick={onAddItem}>
            Add item
          </button>
        </div>
      </div>

      <div className="catalog-filters">
        <input
          className="catalog-search"
          type="search"
          placeholder="Search items…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          aria-label="Search catalog items"
        />
        <select
          className="catalog-filter-select"
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <select
          className="catalog-filter-select"
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="available">Available</option>
          <option value="hidden">Hidden</option>
        </select>
        <span className="catalog-results-count">
          {filtered.length} of {business.items.length} items
        </span>
        {isFiltered && (
          <button className="catalog-clear-filters" type="button" onClick={resetFilters}>
            Clear filters
          </button>
        )}
      </div>

      <div className="catalog-items-table">
        <div className="catalog-items-head">
          <span>Name</span>
          <span>Category</span>
          <span>Price</span>
          <span>Status</span>
          <span></span>
        </div>

        {pageItems.length === 0 && (
          <div className="catalog-empty">
            <p>No items match your search.</p>
            <button type="button" className="ghost-button" onClick={resetFilters}>Clear filters</button>
          </div>
        )}

        {pageItems.map((entry) =>
          editingId === entry.id ? (
            <div className="catalog-item-row catalog-row-editing" key={entry.id}>
              <div className="catalog-edit-fields">
                <label>
                  Name
                  <input
                    autoFocus
                    value={editDraft.name ?? ''}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  />
                </label>
                <label>
                  Category
                  <input
                    list="catalog-edit-categories"
                    value={editDraft.category ?? ''}
                    onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
                  />
                  <datalist id="catalog-edit-categories">
                    {categories.map((cat) => <option key={cat} value={cat} />)}
                  </datalist>
                </label>
                <label>
                  Price
                  <input
                    type="number"
                    min="0"
                    value={editDraft.price ?? ''}
                    onChange={(e) => setEditDraft({ ...editDraft, price: e.target.value as unknown as number })}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={editDraft.description ?? ''}
                    onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                  />
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={editDraft.available ?? true}
                    onChange={(e) => setEditDraft({ ...editDraft, available: e.target.checked })}
                  />
                  Available to customers
                </label>
              </div>
              <div className="catalog-edit-actions">
                <button className="primary-action catalog-save-btn" type="button" onClick={saveEdit}>Save</button>
                <button className="ghost-button" type="button" onClick={cancelEdit}>Cancel</button>
                <button className="danger-button" type="button" onClick={() => removeItem(entry.id)}>Delete</button>
              </div>
            </div>
          ) : (
            <article className="catalog-item-row catalog-row-display" key={entry.id}>
              <div className="catalog-row-name">
                <strong>{entry.name}</strong>
                <span>{entry.description}</span>
              </div>
              <span className="catalog-row-category">{entry.category}</span>
              <span className="catalog-row-price">{currency(entry.price)}</span>
              <span className={entry.available ? 'catalog-badge available' : 'catalog-badge hidden'}>
                {entry.available ? 'Available' : 'Hidden'}
              </span>
              <button className="ghost-button catalog-edit-btn" type="button" onClick={() => startEdit(entry)}>
                Edit
              </button>
            </article>
          )
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination-controls" aria-label="Catalog pagination">
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
            .reduce<(number | '…')[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…')
              acc.push(p)
              return acc
            }, [])
            .map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={p === currentPage ? 'active' : ''}
                  onClick={() => setPage(p as number)}
                >
                  {p}
                </button>
              )
            )}
          <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
            Next
          </button>
        </div>
      )}
    </section>
  )
}

function OrderActionMenu({ order, statusOptions, paymentOptions, onStatusChange, onPaymentChange, onViewDetails }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="order-action-menu" ref={ref}>
      <button
        type="button"
        className="icon-button order-dots-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Order actions"
      >
        <MoreHorizontal size={18} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {open && (
        <div className="order-action-dropdown" role="menu">
          <button type="button" className="order-action-item" role="menuitem" onClick={() => { onViewDetails(); setOpen(false) }}>
            View details
          </button>
          <div className="order-action-divider" />
          <p className="order-action-label">Set status</p>
          {statusOptions.map((s) => (
            <button
              key={s}
              type="button"
              className={`order-action-item${order.status === s ? ' active' : ''}`}
              role="menuitem"
              onClick={() => { onStatusChange(order.id, s); setOpen(false) }}
            >
              {s}
            </button>
          ))}
          <div className="order-action-divider" />
          <p className="order-action-label">Set payment</p>
          {paymentOptions.map((p) => (
            <button
              key={p}
              type="button"
              className={`order-action-item${order.paymentStatus === p ? ' active' : ''}`}
              role="menuitem"
              onClick={() => { onPaymentChange(order.id, p); setOpen(false) }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls = {
    Pending: 'badge-pending',
    Preparing: 'badge-preparing',
    Ready: 'badge-ready',
    Completed: 'badge-completed',
    Cancelled: 'badge-cancelled',
  }[status] ?? 'badge-pending'
  return <span className={`order-badge ${cls}`}>{status}</span>
}

function PaymentBadge({ status }: { status: string }) {
  const cls = {
    Unpaid: 'badge-unpaid',
    Paid: 'badge-paid',
    Refunded: 'badge-refunded',
  }[status] ?? 'badge-unpaid'
  return <span className={`order-badge ${cls}`}>{status}</span>
}

function Dashboard({ business, orders, onClearCompleted, onPaymentChange, onStatusChange }) {
  const statusOptions = ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled']
  const paymentOptions = ['Unpaid', 'Paid', 'Refunded']
  const pageSize = 5
  const [page, setPage] = useState(1)
  const [detailOrderId, setDetailOrderId] = useState('')

  const sampleOrders = useMemo(() => {
    const items = business.items.length ? business.items : defaultBusinesses[0].items
    const pick = (index) => items[index % items.length]
    const makeItems = (start, count) =>
      Array.from({ length: count }, (_, index) => {
        const item = pick(start + index)
        const quantity = (index % 2) + 1
        return {
          id: `${item.id}-sample-${start}-${index}`,
          name: item.name,
          price: item.price,
          quantity,
          lineTotal: item.price * quantity,
        }
      })

    return Array.from({ length: 12 }, (_, index) => {
      const sampleItems = makeItems(index, (index % 3) + 1)
      const createdAt = new Date(Date.now() - index * 48 * 60 * 1000).toISOString()
      const paymentStatus = paymentOptions[index % paymentOptions.length]
      const status = statusOptions[index % statusOptions.length]

      return {
        id: `ORD-SAMPLE-${String(index + 1).padStart(3, '0')}`,
        businessId: business.id,
        merchantId: business.merchantId,
        qrToken: business.qrToken,
        paymentReference: business.paymentReference,
        businessName: business.name,
        customer: {
          name: ['Amina N.', 'Brian K.', 'Clara M.', 'David R.'][index % 4],
          phone: `07${String(70000000 + index * 1379).slice(0, 8)}`,
          location: ['Table 4', 'Counter', 'Gate A', 'Pickup'][index % 4],
          note: index % 3 === 0 ? 'Customer asked for quick pickup.' : '',
        },
        items: sampleItems,
        total: sampleItems.reduce((sum, item) => sum + item.lineTotal, 0),
        paymentStatus,
        status,
        createdAt,
      }
    })
  }, [business])

  const displayOrders = orders.length ? orders : sampleOrders
  const totalPages = Math.max(1, Math.ceil(displayOrders.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageOrders = displayOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const detailOrder = displayOrders.find((order) => order.id === detailOrderId)

  const openCount = orders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length
  const paidSales = orders.filter(o => o.paymentStatus === 'Paid').reduce((sum, o) => sum + o.total, 0)
  const unpaidCount = orders.filter(o => o.paymentStatus === 'Unpaid' && o.status !== 'Cancelled').length
  const completedCount = orders.filter(o => o.status === 'Completed').length

  const firstItem = (currentPage - 1) * pageSize + 1
  const lastItem = Math.min(currentPage * pageSize, displayOrders.length)

  useEffect(() => {
    setPage(1)
    setDetailOrderId('')
  }, [orders.length, business.id])

  return (
    <section className="dashboard">
      {/* Metric cards */}
      <section className="metric-grid" aria-label="Orders summary">
        <div>
          <span>OPEN ORDERS</span>
          <strong>{openCount}</strong>
          <span style={{ color: '#667085', fontWeight: 400 }}>Active right now</span>
        </div>
        <div>
          <span>PAID SALES</span>
          <strong style={{ color: '#10b981' }}>{currency(paidSales)}</strong>
          <span style={{ color: '#10b981', fontWeight: 400 }}>Revenue collected</span>
        </div>
        <div>
          <span>AWAITING PAYMENT</span>
          <strong>{unpaidCount}</strong>
          <span style={{ color: '#667085', fontWeight: 400 }}>Unpaid open orders</span>
        </div>
        <div>
          <span>COMPLETED</span>
          <strong>{completedCount}</strong>
          <span style={{ color: '#10b981', fontWeight: 400 }}>Orders fulfilled</span>
        </div>
      </section>

      {/* Table section */}
      <div className="orders-panel">
        <div className="orders-panel-head">
          <div>
            <p className="eyebrow">Management</p>
            <h3>Orders for {business.name}</h3>
          </div>
          <div className="orders-panel-actions">
            <span className="orders-count-pill">{displayOrders.length} orders</span>
            <button type="button" className="ghost-button orders-clear-btn" onClick={onClearCompleted}>
              <Trash2 size={16} />
              Clear finished
            </button>
          </div>
        </div>

        <div className="orders-table" role="table" aria-label="Orders">
          <div className="orders-table-head" role="row">
            <span>ORDER</span>
            <span>CUSTOMER</span>
            <span>LINE ITEMS</span>
            <span>TOTAL</span>
            <span>STATUS</span>
            <span>PAYMENT</span>
            <span></span>
          </div>

          {pageOrders.map((order) => (
            <article className="order-row" key={order.id} role="row">
              <div className="order-id-cell">
                <strong>{order.id}</strong>
                <span>
                  {new Date(order.createdAt).toLocaleString([], {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div className="order-customer-cell">
                <strong>{order.customer.name}</strong>
                <span>
                  {[order.customer.phone, order.customer.location].filter(Boolean).join(' · ')}
                </span>
              </div>

              <div className="order-chips-cell">
                {order.items.slice(0, 2).map((item) => (
                  <span key={item.id} className="order-item-chip">{item.quantity}x {item.name}</span>
                ))}
                {order.items.length > 2 && (
                  <span className="order-item-chip order-item-chip-more">+{order.items.length - 2} more</span>
                )}
              </div>

              <strong className="order-total-cell">{currency(order.total)}</strong>

              <StatusBadge status={order.status} />

              <PaymentBadge status={order.paymentStatus} />

              <OrderActionMenu
                order={order}
                statusOptions={statusOptions}
                paymentOptions={paymentOptions}
                onStatusChange={onStatusChange}
                onPaymentChange={onPaymentChange}
                onViewDetails={() => setDetailOrderId(order.id)}
              />
            </article>
          ))}
        </div>

        <div className="orders-table-footer">
          <span className="orders-showing">Showing {firstItem}–{lastItem} of {displayOrders.length}</span>
          <div className="pagination-controls" aria-label="Orders pagination">
            <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce<(number | '…')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={p === currentPage ? 'active' : ''}
                    onClick={() => setPage(p as number)}
                  >
                    {p}
                  </button>
                )
              )}
            <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {detailOrder && (
        <div className="order-drawer-layer" role="presentation">
          <button className="order-drawer-backdrop" type="button" onClick={() => setDetailOrderId('')} aria-label="Close order details" />
          <aside className="order-detail-drawer" aria-label="Order details">
            <div className="order-drawer-head">
              <div>
                <p className="eyebrow">Order details</p>
                <h3>{detailOrder.id}</h3>
              </div>
              <button className="icon-button" type="button" onClick={() => setDetailOrderId('')} aria-label="Close order details" title="Close">
                <X size={20} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
            <div className="customer-note">
              <strong>{detailOrder.customer.name}</strong>
              <span>{[detailOrder.customer.phone, detailOrder.customer.location].filter(Boolean).join(' · ')}</span>
              {detailOrder.customer.note && <p>{detailOrder.customer.note}</p>}
            </div>
            <ul className="order-items">
              {detailOrder.items.map((item) => (
                <li key={item.id}>
                  <span>{item.quantity} x {item.name}</span>
                  <strong>{currency(item.lineTotal)}</strong>
                </li>
              ))}
            </ul>
            <div className="payment-status">
              <span>{detailOrder.paymentReference}</span>
              <strong>{detailOrder.paymentStatus}</strong>
            </div>
            <div className="total-row">
              <span>Total</span>
              <strong>{currency(detailOrder.total)}</strong>
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}
export default App

import type { Order, OrderStatus, PaymentStatus } from '../api/types'

export type TimeRange = 'today' | 'week' | 'month' | 'all'
export type MetricRange = 'day' | 'week' | 'month' | 'year'

export interface ChartPoint {
  label: string
  orders: number
  paid: number
  x: number
  y: number
}

export interface MetricSeries {
  label: string
  ordersTotal: string
  paidTotal: string
  yLabels: string[]
  xLabels: string[]
  points: ChartPoint[]
  areaPath: string
  ordersPath: string
  paidPath: string
}

export interface ReportOrderRow {
  id: string
  customer: string
  items: string[]
  total: number
}

export interface ReportData {
  totalRevenue: number
  totalOrders: number
  completedOrders: number
  revenueTrend: number[]
  ordersTrend: number[]
  avgOrderTrend: number[]
  completionTrend: number[]
  itemSales: Array<{ name: string; quantity: number; revenue: number }>
  paymentBreakdown: Record<PaymentStatus, number>
  statusBreakdown: Record<OrderStatus, number>
  ordersByStatus: Record<OrderStatus, ReportOrderRow[]>
}

const STATUS_KEYS: OrderStatus[] = ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled']
const PAYMENT_KEYS: PaymentStatus[] = ['Paid', 'Unpaid', 'Refunded']

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function inRange(order: Order, start: Date | null, end: Date | null) {
  const time = new Date(order.createdAt).getTime()
  if (start && time < start.getTime()) return false
  if (end && time >= end.getTime()) return false
  return true
}

export function filterOrdersByRange(orders: Order[], range: TimeRange): Order[] {
  const now = new Date()
  const today = startOfDay(now)

  if (range === 'today') {
    return orders.filter((order) => inRange(order, today, addDays(today, 1)))
  }
  if (range === 'week') {
    return orders.filter((order) => inRange(order, addDays(today, -6), addDays(today, 1)))
  }
  if (range === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return orders.filter((order) => inRange(order, monthStart, addDays(today, 1)))
  }
  return orders
}

/** Last N calendar days of a numeric metric derived from that day's orders. */
export function dailySeries(
  orders: Order[],
  metric: (dayOrders: Order[]) => number,
  days = 7,
): number[] {
  const today = startOfDay(new Date())
  const series: number[] = []

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = addDays(today, -offset)
    const next = addDays(day, 1)
    const dayOrders = orders.filter((order) => inRange(order, day, next))
    series.push(metric(dayOrders))
  }

  return series
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`
  return String(Math.round(value))
}

function buildPaths(
  values: number[],
  width = 760,
  height = 260,
  top = 24,
  bottom = 238,
) {
  const max = Math.max(...values, 1)
  const count = Math.max(values.length, 1)

  const points = values.map((value, index) => {
    const x = count === 1 ? width / 2 : (index / (count - 1)) * width
    const y = bottom - ((value / max) * (bottom - top))
    return { x, y, value }
  })

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ')

  const areaPath = points.length
    ? `${linePath} L ${width} ${height} L 0 ${height} Z`
    : `M0 ${height} L ${width} ${height} Z`

  const yLabels = [formatCompact(max), formatCompact(max * 0.75), formatCompact(max * 0.5), formatCompact(max * 0.25), '0']

  return { points, linePath, areaPath, yLabels, max }
}

function bucketOrders(
  orders: Order[],
  buckets: Array<{ label: string; start: Date; end: Date }>,
) {
  return buckets.map((bucket) => {
    const bucketOrders = orders.filter((order) => inRange(order, bucket.start, bucket.end))
    const paid = bucketOrders
      .filter((order) => order.paymentStatus === 'Paid')
      .reduce((sum, order) => sum + order.total, 0)
    return {
      label: bucket.label,
      orders: bucketOrders.length,
      paid,
    }
  })
}

function buildMetricBuckets(range: MetricRange, now = new Date()) {
  const today = startOfDay(now)

  if (range === 'day') {
    return Array.from({ length: 8 }, (_, index) => {
      const hour = 8 + index * 2
      const start = new Date(today)
      start.setHours(hour, 0, 0, 0)
      const end = new Date(start)
      end.setHours(hour + 2, 0, 0, 0)
      return {
        label: start.toLocaleTimeString([], { hour: 'numeric' }),
        start,
        end,
      }
    })
  }

  if (range === 'week') {
    return Array.from({ length: 7 }, (_, index) => {
      const start = addDays(today, index - 6)
      return {
        label: start.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        start,
        end: addDays(start, 1),
      }
    })
  }

  if (range === 'month') {
    return Array.from({ length: 5 }, (_, index) => {
      const start = addDays(today, (index - 4) * 7)
      return {
        label: `W${index + 1}`,
        start,
        end: addDays(start, 7),
      }
    })
  }

  return Array.from({ length: 12 }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1)
    return {
      label: start.toLocaleDateString([], { month: 'short' }),
      start,
      end: new Date(now.getFullYear(), now.getMonth() - (11 - index) + 1, 1),
    }
  })
}

export function buildMetricSeries(orders: Order[], range: MetricRange): MetricSeries {
  const buckets = buildMetricBuckets(range)
  const rows = bucketOrders(orders, buckets)
  const orderValues = rows.map((row) => row.orders)
  const paidValues = rows.map((row) => row.paid)
  const orderGeom = buildPaths(orderValues)
  const paidGeom = buildPaths(paidValues)
  const totalOrders = orderValues.reduce((sum, value) => sum + value, 0)
  const totalPaid = paidValues.reduce((sum, value) => sum + value, 0)

  const points: ChartPoint[] = rows.map((row, index) => ({
    label: row.label,
    orders: row.orders,
    paid: row.paid,
    x: orderGeom.points[index]?.x ?? 0,
    y: orderGeom.points[index]?.y ?? 0,
  }))

  const labels: Record<MetricRange, string> = {
    day: '1D',
    week: '1W',
    month: '1M',
    year: '1Y',
  }

  return {
    label: labels[range],
    ordersTotal: formatCompact(totalOrders),
    paidTotal: formatCompact(totalPaid),
    yLabels: orderGeom.yLabels,
    xLabels: rows.map((row) => row.label),
    points,
    areaPath: orderGeom.areaPath,
    ordersPath: orderGeom.linePath,
    paidPath: paidGeom.linePath,
  }
}

export function buildReportData(orders: Order[], range: TimeRange): ReportData {
  const filtered = filterOrdersByRange(orders, range)
  const paidOrders = filtered.filter((order) => order.paymentStatus === 'Paid')
  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.total, 0)
  const totalOrders = filtered.length
  const completedOrders = filtered.filter((order) => order.status === 'Completed').length

  const trendDays = range === 'today' ? 7 : range === 'week' ? 7 : range === 'month' ? 7 : 7
  const revenueTrend = dailySeries(
    filtered,
    (dayOrders) => dayOrders.filter((order) => order.paymentStatus === 'Paid').reduce((sum, order) => sum + order.total, 0),
    trendDays,
  )
  const ordersTrend = dailySeries(filtered, (dayOrders) => dayOrders.length, trendDays)
  const avgOrderTrend = dailySeries(
    filtered,
    (dayOrders) => {
      if (!dayOrders.length) return 0
      return dayOrders.reduce((sum, order) => sum + order.total, 0) / dayOrders.length
    },
    trendDays,
  )
  const completionTrend = dailySeries(
    filtered,
    (dayOrders) => {
      if (!dayOrders.length) return 0
      const completed = dayOrders.filter((order) => order.status === 'Completed').length
      return (completed / dayOrders.length) * 100
    },
    trendDays,
  )

  const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>()
  for (const order of filtered) {
    if (order.status === 'Cancelled') continue
    for (const item of order.items) {
      const existing = itemMap.get(item.name) ?? { name: item.name, quantity: 0, revenue: 0 }
      existing.quantity += item.quantity
      existing.revenue += item.lineTotal
      itemMap.set(item.name, existing)
    }
  }

  const itemSales = [...itemMap.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8)

  const paymentBreakdown = Object.fromEntries(
    PAYMENT_KEYS.map((key) => [
      key,
      filtered.filter((order) => order.paymentStatus === key).reduce((sum, order) => sum + order.total, 0),
    ]),
  ) as Record<PaymentStatus, number>

  const statusBreakdown = Object.fromEntries(
    STATUS_KEYS.map((key) => [key, filtered.filter((order) => order.status === key).length]),
  ) as Record<OrderStatus, number>

  const ordersByStatus = Object.fromEntries(
    STATUS_KEYS.map((status) => [
      status,
      filtered
        .filter((order) => order.status === status)
        .map((order) => ({
          id: order.publicId || order.id,
          customer: order.customer.name,
          items: order.items.map((item) => `${item.quantity}x ${item.name}`),
          total: order.total,
        })),
    ]),
  ) as Record<OrderStatus, ReportOrderRow[]>

  return {
    totalRevenue,
    totalOrders,
    completedOrders,
    revenueTrend,
    ordersTrend,
    avgOrderTrend,
    completionTrend,
    itemSales,
    paymentBreakdown,
    statusBreakdown,
    ordersByStatus,
  }
}

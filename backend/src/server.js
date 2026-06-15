import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { URL } from 'node:url'
import { buildStarterItems, makeCode, readDb, slugify, writeDb } from './store.js'

const port = Number(process.env.PORT ?? 4000)
const scanBaseUrl = process.env.SCAN_BASE_URL ?? 'https://scanit.app'

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  })
  response.end(JSON.stringify(payload))
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk
    })

    request.on('end', () => {
      if (!body) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })
  })
}

function businessUrl(business) {
  return `${scanBaseUrl}/b/${business.id}?qr=${business.qrToken}`
}

function publicBusiness(business) {
  return {
    ...business,
    customerUrl: businessUrl(business),
  }
}

function findBusiness(db, id) {
  return db.businesses.find((business) => business.id === id)
}

function createBusiness(db, payload) {
  const businessName = String(payload.businessName ?? '').trim()
  const ownerName = String(payload.ownerName ?? '').trim()
  const type = String(payload.type ?? 'Restaurant').trim()

  if (!businessName || !ownerName) {
    return { error: 'Business name and owner name are required.' }
  }

  const baseId = slugify(businessName) || `business-${Date.now()}`
  const id = db.businesses.some((business) => business.id === baseId)
    ? `${baseId}-${Date.now().toString().slice(-4)}`
    : baseId

  const business = {
    id,
    merchantId: makeCode('MER', businessName),
    qrToken: makeCode('SIT', businessName),
    name: businessName,
    ownerName,
    phone: String(payload.phone ?? '').trim(),
    type,
    tableLabel: type === 'Boutique' ? 'Delivery or pickup note' : 'Table, seat, or location',
    paymentReference: makeCode('PAY', businessName),
    items: buildStarterItems(type, id),
    createdAt: new Date().toISOString(),
  }

  db.businesses.unshift(business)
  return { business }
}

function createOrder(db, business, payload) {
  const customer = payload.customer ?? {}
  const requestedItems = Array.isArray(payload.items) ? payload.items : []

  if (!String(customer.name ?? '').trim()) {
    return { error: 'Customer name is required.' }
  }

  if (!requestedItems.length) {
    return { error: 'At least one order item is required.' }
  }

  const lines = requestedItems
    .map((line) => {
      const item = business.items.find((entry) => entry.id === line.itemId || entry.id === line.id)
      const quantity = Number(line.quantity ?? 1)

      if (!item || !item.available || !Number.isFinite(quantity) || quantity <= 0) {
        return null
      }

      return {
        id: item.id,
        name: item.name,
        price: item.price,
        quantity,
        lineTotal: item.price * quantity,
      }
    })
    .filter(Boolean)

  if (!lines.length) {
    return { error: 'No available items were found for this order.' }
  }

  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0)
  const order = {
    id: `ORD-${Date.now().toString().slice(-6)}`,
    publicId: randomUUID(),
    businessId: business.id,
    merchantId: business.merchantId,
    qrToken: business.qrToken,
    paymentReference: business.paymentReference,
    customer: {
      name: String(customer.name ?? '').trim(),
      phone: String(customer.phone ?? '').trim(),
      location: String(customer.location ?? '').trim(),
      note: String(customer.note ?? '').trim(),
    },
    items: lines,
    total,
    status: 'Pending',
    paymentStatus: 'Unpaid',
    createdAt: new Date().toISOString(),
  }

  db.orders.unshift(order)
  return { order }
}

async function router(request, response) {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  const url = new URL(request.url, `http://${request.headers.host}`)
  const pathParts = url.pathname.split('/').filter(Boolean)

  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true, service: 'scanit-backend' })
      return
    }

    const db = await readDb()

    if (request.method === 'GET' && url.pathname === '/api/businesses') {
      sendJson(response, 200, { businesses: db.businesses.map(publicBusiness) })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/businesses') {
      const result = createBusiness(db, await readBody(request))

      if (result.error) {
        sendJson(response, 400, { error: result.error })
        return
      }

      await writeDb(db)
      sendJson(response, 201, { business: publicBusiness(result.business) })
      return
    }

    if (request.method === 'GET' && pathParts[0] === 'api' && pathParts[1] === 'qr' && pathParts[2]) {
      const business = db.businesses.find((entry) => entry.qrToken === pathParts[2])

      if (!business) {
        sendJson(response, 404, { error: 'QR code was not found.' })
        return
      }

      sendJson(response, 200, { business: publicBusiness(business) })
      return
    }

    if (pathParts[0] === 'api' && pathParts[1] === 'businesses' && pathParts[2]) {
      const business = findBusiness(db, pathParts[2])

      if (!business) {
        sendJson(response, 404, { error: 'Business was not found.' })
        return
      }

      if (request.method === 'GET' && pathParts.length === 3) {
        sendJson(response, 200, { business: publicBusiness(business) })
        return
      }

      if (request.method === 'GET' && pathParts[3] === 'menu') {
        const qr = url.searchParams.get('qr')

        if (qr && qr !== business.qrToken) {
          sendJson(response, 403, { error: 'QR code does not match this business.' })
          return
        }

        sendJson(response, 200, {
          business: publicBusiness(business),
          items: business.items.filter((item) => item.available),
        })
        return
      }

      if (request.method === 'GET' && pathParts[3] === 'orders') {
        sendJson(response, 200, {
          orders: db.orders.filter((order) => order.businessId === business.id),
        })
        return
      }

      if (request.method === 'POST' && pathParts[3] === 'orders') {
        const result = createOrder(db, business, await readBody(request))

        if (result.error) {
          sendJson(response, 400, { error: result.error })
          return
        }

        await writeDb(db)
        sendJson(response, 201, { order: result.order })
        return
      }
    }

    if (request.method === 'PATCH' && pathParts[0] === 'api' && pathParts[1] === 'orders' && pathParts[2]) {
      const payload = await readBody(request)
      const order = db.orders.find((entry) => entry.id === pathParts[2] || entry.publicId === pathParts[2])

      if (!order) {
        sendJson(response, 404, { error: 'Order was not found.' })
        return
      }

      if (payload.status) order.status = String(payload.status)
      if (payload.paymentStatus) order.paymentStatus = String(payload.paymentStatus)
      order.updatedAt = new Date().toISOString()

      await writeDb(db)
      sendJson(response, 200, { order })
      return
    }

    sendJson(response, 404, { error: 'Route was not found.' })
  } catch (error) {
    const message = error instanceof SyntaxError ? 'Invalid JSON request body.' : 'Server error.'
    sendJson(response, error instanceof SyntaxError ? 400 : 500, { error: message })
  }
}

createServer(router).listen(port, () => {
  console.log(`ScanIT backend running on http://localhost:${port}`)
})

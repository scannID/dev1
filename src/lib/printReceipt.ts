import type { PrintReceipt } from '../api/operations'

export function openPrintReceipt(receipt: PrintReceipt) {
  const lines = receipt.items.map((item) => `${item.quantity}× ${item.name} — UGX ${item.lineTotal.toLocaleString()}`)
  const html = `<!doctype html><html><head><title>${receipt.receiptNumber}</title>
<style>
body{font-family:monospace;width:280px;margin:0 auto;padding:12px}
h1{font-size:16px;margin:0 0 8px} p{margin:4px 0} hr{border:none;border-top:1px dashed #000;margin:8px 0}
</style></head><body>
<h1>${receipt.businessName}</h1>
<p>${receipt.receiptNumber}</p>
<p>${receipt.orderId}</p>
<p>${new Date(receipt.createdAt).toLocaleString()}</p>
<p>${receipt.customerName}${receipt.customerLocation ? ` · ${receipt.customerLocation}` : ''}</p>
<hr />
${lines.map((line) => `<p>${line}</p>`).join('')}
<hr />
<p><strong>Total: UGX ${receipt.total.toLocaleString()}</strong></p>
<script>window.onload=()=>window.print()</script>
</body></html>`
  const win = window.open('', '_blank', 'width=320,height=640')
  if (!win) return
  win.document.write(html)
  win.document.close()

  if (receipt.escPosBase64) {
    try {
      const binary = atob(receipt.escPosBase64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${receipt.receiptNumber}.escpos.bin`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // browser print still works without the binary download
    }
  }
}

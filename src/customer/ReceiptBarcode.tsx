import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

/**
 * Renders a CODE128 barcode for the given orderId.
 * CODE128 handles the full alphanumeric order ID (e.g. "ORD-BCE30B96").
 * The barcode value is the orderId — scanning it yields the order ID
 * which staff or the receipt page use to look up the receipt.
 */
export function ReceiptBarcode({ orderId }: { orderId: string }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !orderId) return
    try {
      JsBarcode(svg, orderId, {
        format: 'CODE128',
        lineColor: '#18211f',
        background: '#ffffff',
        width: 1.8,
        height: 56,
        displayValue: true,
        text: orderId,
        fontSize: 11,
        fontOptions: '600',
        font: 'Outfit, ui-sans-serif, system-ui, sans-serif',
        textMargin: 5,
        margin: 8,
        marginTop: 10,
        marginBottom: 10,
      })
    } catch {
      // orderId may contain chars barcode can't encode — silently hide
      svg.style.display = 'none'
    }
  }, [orderId])

  return (
    <div className="cm-receipt-barcode">
      <svg ref={svgRef} className="cm-receipt-barcode-svg" />
      <p className="cm-receipt-barcode-label">Scan to verify receipt</p>
    </div>
  )
}

import { useEffect, useState, useRef } from 'react'

// Import Poppins font
const fontLink = document.createElement('link')
fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap'
fontLink.rel = 'stylesheet'
if (!document.querySelector('link[href*="Poppins"]')) {
  document.head.appendChild(fontLink)
}

const products = [
  { name: "Grilled Chicken Plate", price: 32000, icon: "🍗", bg: "#FEF3C7", fg: "#92400E" },
  { name: "Tasty Beef Burger", price: 28000, icon: "🍔", bg: "#FEE2E2", fg: "#991B1B" },
  { name: "Grilled Fish & Chips", price: 38000, icon: "🐟", bg: "#DBEAFE", fg: "#1E40AF" },
  { name: "Fresh Passion Juice", price: 9000, icon: "🥤", bg: "#D1FAE5", fg: "#065F46" }
]

const selectedIndexes = [0, 3]

export function KodePhoneDemo() {
  const [currentScreen, setCurrentScreen] = useState(0)
  const [scanLinePos, setScanLinePos] = useState(5)
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null)
  const [showCheck, setShowCheck] = useState(false)
  const scanDirRef = useRef(1)

  // Scan line animation
  useEffect(() => {
    const interval = setInterval(() => {
      setScanLinePos(pos => {
        const newPos = pos + scanDirRef.current * 4
        if (newPos > 158) scanDirRef.current = -1
        if (newPos < 5) scanDirRef.current = 1
        return newPos
      })
    }, 30)
    return () => clearInterval(interval)
  }, [])

  // Main sequence animation
  useEffect(() => {
    const timers: NodeJS.Timeout[] = []

    const runSequence = () => {
      setCurrentScreen(0)
      setSelectedProducts([])
      setSelectedPayment(null)
      setShowCheck(false)

      timers.push(setTimeout(() => setCurrentScreen(1), 1800))
      timers.push(setTimeout(() => setCurrentScreen(2), 3000))
      timers.push(setTimeout(() => setSelectedProducts([0]), 4200))
      timers.push(setTimeout(() => setSelectedProducts([0, 3]), 5000))
      timers.push(setTimeout(() => setCurrentScreen(3), 6200))
      timers.push(setTimeout(() => setCurrentScreen(4), 8200))
      timers.push(setTimeout(() => setSelectedPayment('mtn'), 9400))
      timers.push(setTimeout(() => setCurrentScreen(5), 10800))
      timers.push(setTimeout(() => setShowCheck(true), 11200))
      timers.push(setTimeout(() => runSequence(), 14500))
    }

    runSequence()
    return () => timers.forEach(clearTimeout)
  }, [])

  const total = selectedIndexes.reduce((sum, idx) => sum + products[idx].price, 0)

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
      <div style={{ 
        position: 'relative', 
        width: '300px', 
        padding: '10px 0',
        marginLeft: '-100px',
        filter: 'drop-shadow(0 25px 70px rgba(0,0,0,0.35))' 
      }}>
        {/* Side buttons */}
        <div style={{ position: 'absolute', right: '-2px', top: '120px', width: '3px', height: '60px', background: '#1c1c1e', borderRadius: '2px 0 0 2px' }} />
        <div style={{ position: 'absolute', left: '-2px', top: '90px', width: '3px', height: '32px', background: '#1c1c1e', borderRadius: '0 2px 2px 0' }} />
        <div style={{ position: 'absolute', left: '-2px', top: '140px', width: '3px', height: '62px', background: '#1c1c1e', borderRadius: '0 2px 2px 0' }} />
        
        {/* iPhone body */}
        <div style={{ 
          position: 'relative', 
          width: '300px', 
          height: '614px', 
          background: 'linear-gradient(145deg, #2c2c2e 0%, #1c1c1e 100%)', 
          borderRadius: '48px', 
          padding: '12px', 
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' 
        }}>
          <div style={{ 
            position: 'relative', 
            width: '100%', 
            height: '100%', 
            background: '#ffffff', 
            borderRadius: '38px', 
            overflow: 'hidden', 
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)' 
          }}>
            {/* Status bar */}
            <div style={{ 
              position: 'absolute', top: 0, left: 0, right: 0, height: '54px', 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
              padding: '0 26px', zIndex: 60, 
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(255,255,255,0))',
              fontFamily: "'Poppins', sans-serif"
            }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#000' }}>9:41</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>📶 📡 🔋</div>
            </div>

            {/* Dynamic Island */}
            <div style={{ 
              position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', 
              width: '96px', height: '30px', background: '#000', borderRadius: '16px', 
              zIndex: 70, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' 
            }} />

            {/* Screens Container */}
            <div style={{ position: 'relative', width: '100%', height: '100%', paddingTop: '54px' }}>
              {/* Screen 0: QR Scan */}
              <div style={{ 
                position: 'absolute', inset: 0, top: '54px', 
                background: 'linear-gradient(to bottom, #f8fafc 0%, #ffffff 50%)', 
                opacity: currentScreen === 0 ? 1 : 0, 
                transition: 'opacity 0.4s', 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px',
                fontFamily: "'Poppins', sans-serif"
              }}>
                <p style={{ fontSize: '9px', color: '#64748b', margin: 0, fontWeight: 500 }}>
                  point camera at table qr code
                </p>
                <div style={{ 
                  position: 'relative', width: '170px', height: '170px', 
                  borderRadius: '12px', overflow: 'hidden', 
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)' 
                }}>
                  <svg viewBox="0 0 170 170" width="170" height="170">
                    <rect x="0" y="0" width="170" height="170" rx="10" fill="#ffffff"/>
                    <g fill="#000">
                      <rect x="16" y="16" width="36" height="36"/>
                      <rect x="25" y="25" width="18" height="18" fill="#fff"/>
                      <rect x="118" y="16" width="36" height="36"/>
                      <rect x="127" y="25" width="18" height="18" fill="#fff"/>
                      <rect x="16" y="118" width="36" height="36"/>
                      <rect x="25" y="127" width="18" height="18" fill="#fff"/>
                      <rect x="62" y="18" width="9" height="9"/>
                      <rect x="80" y="27" width="9" height="9"/>
                      <rect x="62" y="45" width="9" height="9"/>
                      <rect x="104" y="63" width="9" height="9"/>
                      <rect x="62" y="63" width="9" height="9"/>
                      <rect x="80" y="72" width="9" height="9"/>
                      <rect x="122" y="81" width="9" height="9"/>
                      <rect x="18" y="72" width="9" height="9"/>
                      <rect x="36" y="81" width="9" height="9"/>
                      <rect x="113" y="113" width="9" height="9"/>
                      <rect x="131" y="131" width="9" height="9"/>
                      <rect x="113" y="140" width="9" height="9"/>
                      <rect x="140" y="113" width="9" height="9"/>
                      <rect x="62" y="131" width="9" height="9"/>
                      <rect x="80" y="140" width="9" height="9"/>
                      <rect x="62" y="150" width="18" height="9"/>
                    </g>
                  </svg>
                  <div style={{ 
                    position: 'absolute', left: '5px', right: '5px', top: `${scanLinePos}px`, 
                    height: '3px', background: 'linear-gradient(90deg, transparent, #0a84ff, transparent)', 
                    boxShadow: '0 0 10px rgba(10,132,255,0.8)' 
                  }} />
                  <div style={{ position: 'absolute', inset: 0, border: '3px solid #0a84ff', borderRadius: '10px', opacity: 0.5 }} />
                </div>
                <div style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px', 
                  background: 'rgba(10,132,255,0.1)', padding: '8px 16px', borderRadius: '20px' 
                }}>
                  <span style={{ fontSize: '11px' }}>📍</span>
                  <p style={{ fontSize: '9px', color: '#0a84ff', margin: 0, fontWeight: 600 }}>table 12</p>
                </div>
              </div>

              {/* Screen 1: Brand */}
              <div style={{ 
                position: 'absolute', inset: 0, top: '54px', 
                background: 'linear-gradient(to bottom, #f8fafc 0%, #ffffff 50%)', 
                opacity: currentScreen === 1 ? 1 : 0, transition: 'opacity 0.4s', 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px',
                fontFamily: "'Poppins', sans-serif"
              }}>
                <div style={{ 
                  width: '72px', height: '72px', borderRadius: '20px', 
                  background: '#0a84ff', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', fontSize: '26px', 
                  boxShadow: '0 8px 24px rgba(10,132,255,0.3)' 
                }}>📱</div>
                <p style={{ 
                  fontSize: '15px', fontWeight: 700, margin: '6px 0 0', 
                  color: '#0f172a', letterSpacing: '-0.02em' 
                }}>scanny</p>
                <p style={{ 
                  fontSize: '10px', color: '#64748b', margin: 0, 
                  textAlign: 'center', padding: '0 40px', fontWeight: 500 
                }}>connecting to tasty grill house</p>
              </div>

              {/* Screen 2: Menu List */}
              <div style={{ 
                position: 'absolute', inset: 0, top: '54px', background: '#f8fafc', 
                opacity: currentScreen === 2 ? 1 : 0, transition: 'opacity 0.4s', 
                display: 'flex', flexDirection: 'column',
                fontFamily: "'Poppins', sans-serif"
              }}>
                <div style={{ padding: '16px 16px 12px', background: 'linear-gradient(to bottom, #ffffff, #f8fafc)' }}>
                  <p style={{ fontSize: '8px', color: '#94a3b8', margin: 0, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    tasty grill house
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, margin: '4px 0 0', color: '#0f172a' }}>menu</p>
                    <span style={{ fontSize: '14px' }}>🛒</span>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px 16px', overflow: 'hidden' }}>
                  {products.map((p, i) => (
                    <div key={i} style={{ 
                      display: 'flex', alignItems: 'center', gap: '14px', 
                      background: selectedProducts.includes(i) ? 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)' : '#ffffff', 
                      border: selectedProducts.includes(i) ? '2px solid #3B82F6' : '1.5px solid #E5E7EB', 
                      borderRadius: '16px', padding: '14px', transition: 'all 0.3s ease', 
                      boxShadow: selectedProducts.includes(i) 
                        ? '0 8px 16px rgba(59,130,246,0.15), 0 0 0 4px rgba(59,130,246,0.08)' 
                        : '0 2px 8px rgba(0,0,0,0.04)',
                      transform: selectedProducts.includes(i) ? 'scale(1.02)' : 'scale(1)'
                    }}>
                      <div style={{ 
                        width: '52px', height: '52px', borderRadius: '14px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        flexShrink: 0, background: p.bg, fontSize: '18px', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        border: `2px solid ${p.bg}`,
                        position: 'relative'
                      }}>
                        {p.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ 
                          fontSize: '11px', fontWeight: 700, margin: 0, color: '#1E293B',
                          letterSpacing: '-0.01em', lineHeight: 1.3
                        }}>{p.name}</p>
                        <p style={{ 
                          fontSize: '9px', color: '#3B82F6', margin: '3px 0 0', 
                          fontWeight: 700, letterSpacing: '-0.01em' 
                        }}>
                          UGX {p.price.toLocaleString()}
                        </p>
                      </div>
                      <div style={{ 
                        fontSize: '16px', 
                        color: selectedProducts.includes(i) ? '#3B82F6' : '#D1D5DB',
                        transition: 'all 0.3s ease',
                        transform: selectedProducts.includes(i) ? 'rotate(90deg) scale(1.1)' : 'rotate(0deg) scale(1)'
                      }}>
                        {selectedProducts.includes(i) ? '✓' : '➕'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Screen 3: Order Summary */}
              <div style={{ 
                position: 'absolute', inset: 0, top: '54px', background: '#f8fafc', 
                opacity: currentScreen === 3 ? 1 : 0, transition: 'opacity 0.4s', 
                display: 'flex', flexDirection: 'column',
                fontFamily: "'Poppins', sans-serif"
              }}>
                <div style={{ padding: '16px 16px 12px', background: 'linear-gradient(to bottom, #ffffff, #f8fafc)' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: '#0f172a' }}>your order</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <span style={{ fontSize: '10px' }}>📍</span>
                    <p style={{ fontSize: '9px', color: '#64748b', margin: 0, fontWeight: 500 }}>table 12</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 16px' }}>
                  {selectedIndexes.map(idx => {
                    const p = products[idx]
                    return (
                      <div key={idx} style={{ 
                        display: 'flex', alignItems: 'center', gap: '12px', background: '#ffffff', 
                        border: '1px solid #e2e8f0', borderRadius: '14px', padding: '12px', 
                        boxShadow: '0 2px 4px rgba(0,0,0,0.04)' 
                      }}>
                        <div style={{ 
                          width: '40px', height: '40px', borderRadius: '10px', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          background: p.bg, fontSize: '13px', 
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)' 
                        }}>{p.icon}</div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '10px', fontWeight: 600, margin: 0, color: '#0f172a' }}>{p.name}</p>
                        </div>
                        <p style={{ fontSize: '10px', fontWeight: 700, margin: 0, color: '#0a84ff' }}>
                          UGX {p.price.toLocaleString()}
                        </p>
                      </div>
                    )
                  })}
                </div>
                <div style={{ 
                  marginTop: 'auto', padding: '16px', background: '#ffffff', 
                  borderTop: '1px solid #e2e8f0' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '12px' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>total</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>UGX {total.toLocaleString()}</span>
                  </div>
                  <button style={{ 
                    width: '100%', background: 'linear-gradient(135deg, #0a84ff 0%, #0066cc 100%)', 
                    color: '#fff', border: 'none', padding: '14px', fontSize: '11px', 
                    fontWeight: 700, borderRadius: '12px', cursor: 'pointer', 
                    boxShadow: '0 4px 12px rgba(10,132,255,0.3)',
                    fontFamily: "'Poppins', sans-serif"
                  }}>checkout</button>
                </div>
              </div>

              {/* Screen 4: Payment */}
              <div style={{ 
                position: 'absolute', inset: 0, top: '54px', background: '#f8fafc', 
                opacity: currentScreen === 4 ? 1 : 0, transition: 'opacity 0.4s', 
                display: 'flex', flexDirection: 'column',
                fontFamily: "'Poppins', sans-serif"
              }}>
                <div style={{ padding: '16px 16px 12px', background: 'linear-gradient(to bottom, #ffffff, #f8fafc)' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: '#0f172a' }}>pay with</p>
                  <p style={{ fontSize: '9px', color: '#64748b', margin: '4px 0 0', fontWeight: 500 }}>
                    choose mobile money
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px 16px' }}>
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: '12px', background: '#ffffff', 
                    border: selectedPayment === 'mtn' ? '2px solid #0a84ff' : '1px solid #e2e8f0', 
                    borderRadius: '14px', padding: '14px', transition: 'all 0.3s', 
                    boxShadow: selectedPayment === 'mtn' ? '0 4px 12px rgba(10,132,255,0.15)' : '0 2px 4px rgba(0,0,0,0.04)' 
                  }}>
                    <div style={{ 
                      width: '42px', height: '42px', borderRadius: '10px', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      fontSize: '9px', fontWeight: 700, flexShrink: 0, 
                      background: '#FAEEDA', color: '#412402', 
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)' 
                    }}>MTN</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '10px', fontWeight: 600, margin: 0, color: '#0f172a' }}>mtn mobile money</p>
                      <p style={{ fontSize: '9px', color: '#64748b', margin: '2px 0 0', fontWeight: 500 }}>**** 4421</p>
                    </div>
                    <div style={{ fontSize: '16px', color: selectedPayment === 'mtn' ? '#0a84ff' : '#cbd5e1' }}>
                      {selectedPayment === 'mtn' ? '✅' : '⭕'}
                    </div>
                  </div>
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: '12px', background: '#ffffff', 
                    border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px', 
                    boxShadow: '0 2px 4px rgba(0,0,0,0.04)' 
                  }}>
                    <div style={{ 
                      width: '42px', height: '42px', borderRadius: '10px', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      fontSize: '8px', fontWeight: 700, flexShrink: 0, 
                      background: '#FCEBEB', color: '#501313', 
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)' 
                    }}>Airtel</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '10px', fontWeight: 600, margin: 0, color: '#0f172a' }}>airtel money</p>
                      <p style={{ fontSize: '9px', color: '#64748b', margin: '2px 0 0', fontWeight: 500 }}>**** 0093</p>
                    </div>
                    <div style={{ fontSize: '16px', color: '#cbd5e1' }}>⭕</div>
                  </div>
                </div>
                <div style={{ marginTop: 'auto', padding: '16px', background: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
                  <button style={{ 
                    width: '100%', background: 'linear-gradient(135deg, #0a84ff 0%, #0066cc 100%)', 
                    color: '#fff', border: 'none', padding: '14px', fontSize: '11px', 
                    fontWeight: 700, borderRadius: '12px', cursor: 'pointer', 
                    boxShadow: '0 4px 12px rgba(10,132,255,0.3)',
                    fontFamily: "'Poppins', sans-serif"
                  }}>confirm payment</button>
                </div>
              </div>

              {/* Screen 5: Success */}
              <div style={{ 
                position: 'absolute', inset: 0, top: '54px', 
                background: 'linear-gradient(135deg, #EAF3DE 0%, #d4edda 100%)', 
                opacity: currentScreen === 5 ? 1 : 0, transition: 'opacity 0.4s', 
                display: 'flex', flexDirection: 'column', alignItems: 'center', 
                justifyContent: 'center', gap: '20px',
                fontFamily: "'Poppins', sans-serif"
              }}>
                <div style={{ 
                  width: '80px', height: '80px', borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  transform: showCheck ? 'scale(1)' : 'scale(0)', 
                  transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)', 
                  fontSize: '28px', color: '#ffffff', 
                  boxShadow: '0 8px 24px rgba(16,185,129,0.3)' 
                }}>✓</div>
                <div style={{ textAlign: 'center', padding: '0 32px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#166534' }}>
                    payment successful
                  </p>
                  <p style={{ 
                    fontSize: '10px', color: '#15803d', margin: '8px 0 0', 
                    fontWeight: 500, lineHeight: 1.5 
                  }}>
                    order sent to tasty grill house kitchen
                  </p>
                </div>
              </div>
            </div>

            {/* Home Indicator */}
            <div style={{ 
              position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', 
              width: '120px', height: '5px', 
              background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.8), transparent)', 
              borderRadius: '3px', zIndex: 70 
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}

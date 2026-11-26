import { useState } from 'react'
import { Home, Bed, Bath, Maximize2, Building2, ChevronLeft, ChevronRight, Phone } from 'lucide-react'
import type { UnitPickOption } from './types'
import './VacantUnitsShowcase.css'

interface VacantUnitsShowcaseProps {
  propertyName: string
  propertyAddress?: string
  city?: string
  units: UnitPickOption[]
  currency: string
  ownerName: string
  ownerPhone?: string
}

const UNITS_PER_PAGE = 10

function money(n: number, currency: string) {
  return `${n.toLocaleString()} ${currency}`
}

export default function VacantUnitsShowcase({
  propertyName,
  propertyAddress,
  city,
  units,
  currency,
  ownerName,
  ownerPhone,
}: VacantUnitsShowcaseProps) {
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Filter only vacant units
  const vacantUnits = units.filter((u) => !u.hasActiveTenant)

  // Group units by floor
  const unitsByFloor = vacantUnits.reduce((acc, u) => {
    const floor = u.floor || 'Ground Floor'
    if (!acc[floor]) acc[floor] = []
    acc[floor].push(u)
    return acc
  }, {} as Record<string, typeof vacantUnits>)

  const floors = Object.keys(unitsByFloor).sort()
  const filteredUnits = selectedFloor ? unitsByFloor[selectedFloor] : vacantUnits

  // Pagination
  const totalPages = Math.ceil(filteredUnits.length / UNITS_PER_PAGE)
  const startIdx = (currentPage - 1) * UNITS_PER_PAGE
  const endIdx = startIdx + UNITS_PER_PAGE
  const displayUnits = filteredUnits.slice(startIdx, endIdx)

  // Reset to page 1 when filter changes
  const handleFloorChange = (floor: string | null) => {
    setSelectedFloor(floor)
    setCurrentPage(1)
  }

  // Parse amenities into array
  function parseAmenities(amenities: string | null): string[] {
    if (!amenities) return []
    return amenities
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)
      .filter((a) => a !== '[SECURITY_DEPOSIT_REQUIRED]') // Filter out the marker
  }

  // Calculate square footage placeholder (can be added to backend later)
  function getSquareFeet(bedrooms: number | null): string {
    if (!bedrooms) return '—'
    // Rough estimate: studio=400, 1br=600, 2br=850, 3br=1100
    const base = bedrooms === 0 ? 400 : bedrooms === 1 ? 600 : bedrooms === 2 ? 850 : 1100
    return `${base} sq ft`
  }

  return (
    <div className="vus-page">
      {/* ── Header ── */}
      <header className="vus-header">
        <div className="vus-header-content">
          <div className="vus-brand">
            <img
              src="/koddlylogo3.png"
              alt="Koddly"
              className="vus-brand-logo"
            />
            <div>
              <h1 className="vus-brand-name">{propertyName}</h1>
              {ownerPhone && (
                <div className="vus-contact-stack">
                  <div className="vus-call-info">
                    <Phone size={12} />
                    <span>Call</span>
                    <a href={`tel:${ownerPhone}`} className="vus-manager-phone">
                      {ownerPhone}
                    </a>
                  </div>
                  <div className="vus-manager-name">{ownerName}</div>
                </div>
              )}
            </div>
          </div>
          <div className="vus-header-badge">
            <span className="vus-available-count">{vacantUnits.length}</span>
            <span className="vus-available-label">Available</span>
          </div>
        </div>
      </header>

      {/* ── Floor Filter ── */}
      {floors.length > 1 && (
        <div className="vus-filter-bar">
          <button
            type="button"
            className={`vus-filter-chip${!selectedFloor ? ' active' : ''}`}
            onClick={() => handleFloorChange(null)}
          >
            All Floors
          </button>
          {floors.map((floor) => (
            <button
              key={floor}
              type="button"
              className={`vus-filter-chip${selectedFloor === floor ? ' active' : ''}`}
              onClick={() => handleFloorChange(floor)}
            >
              {floor}
            </button>
          ))}
        </div>
      )}

      {/* ── Units Grid ── */}
      <div className="vus-content">
        {displayUnits.length === 0 ? (
          <div className="vus-empty">
            <Home size={48} style={{ opacity: 0.2 }} />
            <p className="vus-empty-title">No units available</p>
            <p className="vus-empty-desc">
              All units on {selectedFloor || 'this property'} are currently occupied.
            </p>
          </div>
        ) : (
          <div className="vus-grid">
            {displayUnits.map((unit) => {
              const amenities = parseAmenities(unit.amenities)
              return (
                <div key={unit.unitId} className="vus-card">
                  {/* Card header with unit number and price */}
                  <div className="vus-card-header">
                    <div>
                      <h3 className="vus-unit-number">Unit {unit.unitNumber}</h3>
                      <p className="vus-security-deposit">
                        {unit.amenities?.includes('[SECURITY_DEPOSIT_REQUIRED]') 
                          ? 'Security deposit inclusive'
                          : ''}
                      </p>
                    </div>
                    <div className="vus-price-block">
                      <div className="vus-available-badge">Available Now</div>
                      <span className="vus-price">{money(unit.monthlyAmount, currency)}</span>
                      <span className="vus-price-period">/month</span>
                    </div>
                  </div>

                  {/* Specs row */}
                  <div className="vus-specs">
                    <div className="vus-spec">
                      <Bed size={14} />
                      <span className="vus-spec-label">Bed</span>
                      <span className="vus-spec-value">
                        {unit.bedrooms != null ? `${unit.bedrooms} Bed${unit.bedrooms !== 1 ? 's' : ''}` : '—'}
                      </span>
                    </div>
                    <div className="vus-spec">
                      <Bath size={14} />
                      <span className="vus-spec-label">Bath</span>
                      <span className="vus-spec-value">
                        {unit.bathrooms != null ? `${unit.bathrooms.toFixed(1)} Bath` : '—'}
                      </span>
                    </div>
                    <div className="vus-spec">
                      <Maximize2 size={14} />
                      <span className="vus-spec-label">Size</span>
                      <span className="vus-spec-value">{getSquareFeet(unit.bedrooms)}</span>
                    </div>
                    <div className="vus-spec">
                      <Building2 size={14} />
                      <span className="vus-spec-label">Floor</span>
                      <span className="vus-spec-value">{unit.floor || 'Ground'}</span>
                    </div>
                  </div>

                  {/* Amenities pills */}
                  {amenities.length > 0 && (
                    <div className="vus-amenities">
                      {amenities.slice(0, 3).map((amenity, idx) => (
                        <span key={idx} className="vus-amenity-pill">
                          {amenity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="vus-pagination">
          <button
            type="button"
            className="vus-page-btn"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="vus-page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="vus-page-btn"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="vus-footer">
        <p className="vus-footer-text">Powered by Qbilabs SMC Ltd</p>
      </footer>
    </div>
  )
}

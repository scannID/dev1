import { useMemo, useState } from 'react'
import { ArrowLeft, Bath, BedDouble, Users } from 'lucide-react'
import type { CatalogItem } from '../../api/types'
import { isLodgingItem, nightsBetween } from '../../lib/catalogCart'
import { discountPercentOf, effectivePrice } from '../../lib/catalogPricing'
import { getCategoryImage } from '../../lib/categoryImages'
import { currency, usdEquiv } from '../utils'

function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function UsdHint({ amount }: { amount: number }) {
  const usd = usdEquiv(amount)
  return usd ? <span className="cm-usd">{usd}</span> : null
}

export function StayStep({
  items,
  onAddStay,
}: {
  items: CatalogItem[]
  onAddStay: (itemId: string, checkInDate: string, checkOutDate: string) => void
}) {
  const lodging = useMemo(
    () => items.filter((item) => item.available && isLodgingItem(item)),
    [items],
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checkIn, setCheckIn] = useState(todayIso())
  const [checkOut, setCheckOut] = useState(addDaysIso(todayIso(), 1))
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [checkInError, setCheckInError] = useState<string | null>(null)
  const [checkOutError, setCheckOutError] = useState<string | null>(null)

  const selected = selectedId ? lodging.find((item) => item.id === selectedId) ?? null : null
  const minCheckIn = todayIso()
  const datesValid = Boolean(checkIn && checkOut && checkIn >= minCheckIn && checkOut > checkIn)
  const nights = datesValid ? nightsBetween(checkIn, checkOut) : 0
  const gallery = selected
    ? selected.imageUrls?.length
      ? selected.imageUrls
      : selected.imageUrl
        ? [selected.imageUrl]
        : []
    : []

  function openItem(item: CatalogItem) {
    setSelectedId(item.id)
    setGalleryIndex(0)
    setCheckInError(null)
    setCheckOutError(null)
    setCheckIn(todayIso())
    setCheckOut(addDaysIso(todayIso(), 1))
  }

  function validateDates(nextCheckIn = checkIn, nextCheckOut = checkOut) {
    let ok = true
    if (!nextCheckIn.trim()) {
      setCheckInError('Select a check-in date')
      ok = false
    } else if (nextCheckIn < minCheckIn) {
      setCheckInError('Check-in can’t be in the past')
      ok = false
    } else {
      setCheckInError(null)
    }

    if (!nextCheckOut.trim()) {
      setCheckOutError('Select a check-out date')
      ok = false
    } else if (nextCheckIn && nextCheckOut <= nextCheckIn) {
      setCheckOutError('Check-out must be after check-in')
      ok = false
    } else {
      setCheckOutError(null)
    }
    return ok
  }

  function book() {
    if (!selected) return
    if (!validateDates()) return
    onAddStay(selected.id, checkIn, checkOut)
  }

  if (selected) {
    const off = discountPercentOf(selected)
    const nightly = effectivePrice(selected)
    const stayTotal = nightly * nights
    return (
      <div className="cm-step cm-step-enter cm-panel">
        <button type="button" className="cm-ghost-btn" onClick={() => setSelectedId(null)}>
          <ArrowLeft size={16} /> All rooms
        </button>
        <div className="cm-stay-gallery">
          {gallery.length > 0 ? (
            <img src={gallery[Math.min(galleryIndex, gallery.length - 1)]} alt="" />
          ) : (
            <div className="cm-stay-gallery-empty">No photos yet</div>
          )}
          {gallery.length > 1 ? (
            <div className="cm-stay-thumbs">
              {gallery.map((url, index) => (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  className={index === galleryIndex ? 'active' : undefined}
                  onClick={() => setGalleryIndex(index)}
                >
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="cm-stay-head">
          <div>
            <p className="cm-stay-kind">{selected.itemKind === 'SUITE' ? 'Suite' : 'Room'}</p>
            <h2>{selected.name}</h2>
          </div>
          <strong className="cm-stay-amount">
            {currency(nightly)}
            <UsdHint amount={nightly} />
            <span className="cm-muted"> / night</span>
            {off > 0 ? <span className="cm-price-was">{currency(selected.price)}</span> : null}
          </strong>
        </div>
        <p className="cm-muted">{selected.description}</p>
        <div className="cm-stay-meta">
          <span><Users size={14} /> {selected.capacity ?? 1} guests</span>
          <span><BedDouble size={14} /> {selected.unitsAvailable ?? 1} units</span>
          {(selected.amenities?.length ?? 0) > 0 ? (
            <span><Bath size={14} /> {selected.amenities!.slice(0, 3).join(', ')}</span>
          ) : null}
        </div>
        {(selected.amenities?.length ?? 0) > 0 ? (
          <div className="cm-stay-amenities">
            {selected.amenities!.map((amenity) => (
              <span key={amenity}>{amenity}</span>
            ))}
          </div>
        ) : null}
        {selected.details ? <p className="cm-stay-details">{selected.details}</p> : null}

        <div className="cm-stay-dates">
          <label>
            Check-in
            <input
              type="date"
              value={checkIn}
              min={minCheckIn}
              required
              aria-required="true"
              aria-invalid={Boolean(checkInError)}
              onChange={(e) => {
                const next = e.target.value
                setCheckIn(next)
                const nextOut = checkOut && checkOut > next ? checkOut : addDaysIso(next || minCheckIn, 1)
                if (nextOut !== checkOut) setCheckOut(nextOut)
                validateDates(next, nextOut)
              }}
            />
            {checkInError ? <span className="cm-field-error">{checkInError}</span> : null}
          </label>
          <label>
            Check-out
            <input
              type="date"
              value={checkOut}
              min={checkIn ? addDaysIso(checkIn, 1) : addDaysIso(minCheckIn, 1)}
              required
              aria-required="true"
              aria-invalid={Boolean(checkOutError)}
              onChange={(e) => {
                const next = e.target.value
                setCheckOut(next)
                validateDates(checkIn, next)
              }}
            />
            {checkOutError ? <span className="cm-field-error">{checkOutError}</span> : null}
          </label>
        </div>
        <p className="cm-muted">
          {datesValid
            ? <>{nights} night{nights === 1 ? '' : 's'} · <span className="cm-stay-amount">{currency(stayTotal)}<UsdHint amount={stayTotal} /></span></>
            : 'Choose valid check-in and check-out dates'}
        </p>
        <button type="button" className="cm-primary cm-full" onClick={book} disabled={!datesValid}>
          Add stay to cart
        </button>
      </div>
    )
  }

  return (
    <div className="cm-step cm-step-enter cm-panel">
      <h2>Stay with us</h2>
      <p className="cm-muted">Pick a room or suite, then choose your dates.</p>
      {lodging.length === 0 ? (
        <p className="cm-muted">No rooms listed yet. Browse food from the menu tab.</p>
      ) : (
        <div className="cm-stay-grid">
          {lodging.map((item) => {
            const thumb = item.imageUrl || item.imageUrls?.[0] || getCategoryImage(item.category)
            const nightly = effectivePrice(item)
            return (
              <button key={item.id} type="button" className="cm-stay-card" onClick={() => openItem(item)}>
                <div className="cm-stay-card-media">
                  {thumb ? <img src={thumb} alt="" /> : <span>No photo</span>}
                </div>
                <div className="cm-stay-card-body">
                  <strong>{item.name}</strong>
                  <span className="cm-muted">
                    {item.itemKind === 'SUITE' ? 'Suite' : 'Room'} · {item.capacity ?? 1} guests
                  </span>
                  <span className="cm-stay-amount">{currency(nightly)}<UsdHint amount={nightly} /> / night</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

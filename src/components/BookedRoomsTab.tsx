import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BedDouble, CalendarCheck, LogIn, LogOut, Wrench, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { operationsApi, type BookedRoom } from '../api/operations'
import type { RoomStatus } from '../api/types'

const STATUS_META: Record<
  RoomStatus,
  { label: string; className: string }
> = {
  VACANT:            { label: 'Vacant',        className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  BOOKED:            { label: 'Booked',         className: 'bg-blue-50 text-blue-700 border-blue-200' },
  OCCUPIED:          { label: 'Occupied',       className: 'bg-amber-50 text-amber-700 border-amber-200' },
  CHECKOUT_PENDING:  { label: 'Checkout Due',   className: 'bg-red-50 text-red-700 border-red-200' },
  UNDER_MAINTENANCE: { label: 'Maintenance',    className: 'bg-muted text-muted-foreground' },
}

function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.VACANT
  return (
    <Badge variant="secondary" className={meta.className}>
      {meta.label}
    </Badge>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function currency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

interface ExtendDialogProps {
  room: BookedRoom
  onConfirm: (newDate: string) => Promise<void>
  onClose: () => void
}

function ExtendDialog({ room, onConfirm, onClose }: ExtendDialogProps) {
  const currentCheckOut = room.currentBooking?.checkOut ?? ''
  const minDate = currentCheckOut
    ? new Date(new Date(currentCheckOut).getTime() + 86400000).toISOString().slice(0, 10)
    : new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const [newDate, setNewDate] = useState(minDate)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (!newDate) return
    setLoading(true)
    try {
      await onConfirm(newDate)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Extend Stay — {room.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {currentCheckOut ? (
            <p className="text-sm text-muted-foreground">
              Current checkout: <strong>{formatDate(currentCheckOut)}</strong>
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="new-checkout">New checkout date</Label>
            <DatePicker
              id="new-checkout"
              value={newDate}
              min={minDate}
              onChange={setNewDate}
              aria-label="New checkout date"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={() => void handleConfirm()} disabled={loading || !newDate}>
            {loading ? 'Saving…' : 'Extend stay'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BookedRoomsTab({ businessId }: { businessId: string }) {
  const [rooms, setRooms] = useState<BookedRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [extendRoom, setExtendRoom] = useState<BookedRoom | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await operationsApi.listBookedRooms(businessId)
      setRooms(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load booked rooms')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { void load() }, [load])

  async function handleCheckIn(room: BookedRoom) {
    setActionLoading(room.itemId + ':checkin')
    try {
      const updated = await operationsApi.roomCheckIn(businessId, room.itemId)
      setRooms((prev) => prev.map((r) => r.itemId === updated.itemId ? updated : r))
      toast.success(`${room.name} — guest checked in`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to check in')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCheckOut(room: BookedRoom) {
    setActionLoading(room.itemId + ':checkout')
    try {
      const updated = await operationsApi.roomCheckOut(businessId, room.itemId)
      // Checked-out rooms are VACANT — remove from this view
      setRooms((prev) => prev.filter((r) => r.itemId !== updated.itemId))
      toast.success(`${room.name} — checked out, now vacant`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to check out')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMaintenance(room: BookedRoom) {
    setActionLoading(room.itemId + ':maintenance')
    try {
      const updated = await operationsApi.roomToggleMaintenance(businessId, room.itemId)
      if (updated.roomStatus === 'VACANT') {
        setRooms((prev) => prev.filter((r) => r.itemId !== updated.itemId))
        toast.success(`${room.name} — back to vacant`)
      } else {
        setRooms((prev) => prev.map((r) => r.itemId === updated.itemId ? updated : r))
        toast.success(`${room.name} — marked for maintenance`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update maintenance status')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleExtend(room: BookedRoom, newCheckOutDate: string) {
    try {
      const result = await operationsApi.roomExtendStay(businessId, room.itemId, newCheckOutDate)
      toast.success(
        `Stay extended by ${result.additionalNights} night${result.additionalNights === 1 ? '' : 's'} (+${currency(result.additionalCharge)})`
      )
      setExtendRoom(null)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to extend stay')
      throw err
    }
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Loading booked rooms…
      </div>
    )
  }

  if (rooms.length === 0) {
    return (
      <div className="py-16 text-center space-y-2">
        <BedDouble className="mx-auto size-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No rooms are currently booked or occupied.</p>
        <p className="text-xs text-muted-foreground">Rooms will appear here once a booking is placed.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rooms.map((room) => {
          const booking = room.currentBooking
          const busyCheckIn   = actionLoading === room.itemId + ':checkin'
          const busyCheckOut  = actionLoading === room.itemId + ':checkout'
          const busyMaint     = actionLoading === room.itemId + ':maintenance'

          return (
            <article
              key={room.itemId}
              className="rounded-xl border border-border bg-card overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-border">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">{room.name}</h3>
                  <p className="text-xs text-muted-foreground">{room.category}</p>
                </div>
                <RoomStatusBadge status={room.roomStatus} />
              </div>

              {/* Booking info */}
              <div className="flex-1 px-4 py-3 space-y-2">
                {booking ? (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">{booking.guestName}</span>
                      {booking.guestPhone ? (
                        <span className="text-xs text-muted-foreground">{booking.guestPhone}</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarCheck className="size-3.5 shrink-0" />
                      <span>{formatDate(booking.checkIn)}</span>
                      <ArrowRight className="size-3" />
                      <span>{formatDate(booking.checkOut)}</span>
                      <span className="ml-1 font-medium text-foreground">
                        {booking.nights} night{booking.nights === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {booking.orderId} · {currency(booking.lineTotal)}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No active booking record found.</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 px-4 pb-4">
                {room.roomStatus === 'BOOKED' ? (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs gap-1"
                    disabled={busyCheckIn}
                    onClick={() => void handleCheckIn(room)}
                  >
                    <LogIn className="size-3.5" />
                    {busyCheckIn ? 'Checking in…' : 'Check in'}
                  </Button>
                ) : null}

                {(room.roomStatus === 'OCCUPIED' || room.roomStatus === 'CHECKOUT_PENDING' || room.roomStatus === 'BOOKED') ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      disabled={busyCheckOut}
                      onClick={() => void handleCheckOut(room)}
                    >
                      <LogOut className="size-3.5" />
                      {busyCheckOut ? 'Checking out…' : 'Check out'}
                    </Button>
                    {booking ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => setExtendRoom(room)}
                      >
                        <ArrowRight className="size-3.5" />
                        Extend stay
                      </Button>
                    ) : null}
                  </>
                ) : null}

                {room.roomStatus !== 'BOOKED' && room.roomStatus !== 'OCCUPIED' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 text-muted-foreground"
                    disabled={busyMaint}
                    onClick={() => void handleMaintenance(room)}
                  >
                    <Wrench className="size-3.5" />
                    {room.roomStatus === 'UNDER_MAINTENANCE'
                      ? (busyMaint ? 'Clearing…' : 'Mark vacant')
                      : (busyMaint ? 'Flagging…' : 'Maintenance')}
                  </Button>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>

      {extendRoom ? (
        <ExtendDialog
          room={extendRoom}
          onConfirm={(newDate) => handleExtend(extendRoom, newDate)}
          onClose={() => setExtendRoom(null)}
        />
      ) : null}
    </>
  )
}

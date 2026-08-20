"use client"

import * as React from "react"
import { format, parseISO, isValid } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * DatePicker — shadcn Calendar inside a Popover.
 *
 * Props mirror a controlled <input type="date"> so it's a drop-in replacement:
 *   value   — ISO date string "YYYY-MM-DD" or ""
 *   onChange — called with "YYYY-MM-DD" or "" when cleared
 *   min     — ISO date string "YYYY-MM-DD" — days before this are disabled
 *   max     — ISO date string "YYYY-MM-DD" — days after this are disabled
 */
interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  min?: string
  max?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Extra classNames forwarded to the trigger button */
  triggerClassName?: string
  id?: string
  "aria-label"?: string
  "aria-required"?: boolean
  "aria-invalid"?: boolean | "true" | "false"
}

function isoToDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined
  const d = parseISO(iso)
  return isValid(d) ? d : undefined
}

function dateToIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Pick a date",
  disabled = false,
  className,
  triggerClassName,
  id,
  "aria-label": ariaLabel,
  "aria-required": ariaRequired,
  "aria-invalid": ariaInvalid,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const selected = isoToDate(value)
  const minDate = isoToDate(min)
  const maxDate = isoToDate(max)

  function handleSelect(day: Date | undefined) {
    onChange?.(day ? dateToIso(day) : "")
    setOpen(false)
  }

  const displayLabel = selected
    ? format(selected, "EEE, d MMM yyyy")
    : placeholder

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel ?? placeholder}
          aria-required={ariaRequired}
          aria-invalid={ariaInvalid}
          className={cn(
            "w-full justify-start text-left font-normal",
            !selected && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0 opacity-60" />
          {displayLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-auto p-0", className)} align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          disabled={(day) => {
            if (minDate && day < minDate) return true
            if (maxDate && day > maxDate) return true
            return false
          }}
          captionLayout="label"
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

/**
 * DateTimePicker — adds a time input below the calendar.
 * Returns an ISO datetime-local string "YYYY-MM-DDTHH:MM".
 */
interface DateTimePickerProps {
  value?: string          // "YYYY-MM-DDTHH:MM" or ""
  onChange?: (value: string) => void
  min?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  "aria-label"?: string
}

export function DateTimePicker({
  value,
  onChange,
  min,
  placeholder = "Pick date & time",
  disabled = false,
  id,
  "aria-label": ariaLabel,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)

  const datePart = value?.slice(0, 10) ?? ""
  const timePart = value?.slice(11, 16) ?? "09:00"

  const selected = isoToDate(datePart)
  const minDate = isoToDate(min?.slice(0, 10))

  function handleSelectDay(day: Date | undefined) {
    const newDate = day ? dateToIso(day) : ""
    onChange?.(newDate ? `${newDate}T${timePart}` : "")
    if (day) setOpen(false)
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (datePart) onChange?.(`${datePart}T${e.target.value}`)
  }

  const displayLabel = selected
    ? `${format(selected, "EEE, d MMM yyyy")} ${timePart}`
    : placeholder

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel ?? placeholder}
          className={cn(
            "w-full justify-start text-left font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0 opacity-60" />
          {displayLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelectDay}
          disabled={(day) => {
            if (minDate && day < minDate) return true
            return false
          }}
          captionLayout="label"
          autoFocus
        />
        {/* Time picker shown once a date is selected */}
        {datePart && (
          <div className="border-t border-border px-3 py-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Time</span>
            <input
              type="time"
              value={timePart}
              onChange={handleTimeChange}
              className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

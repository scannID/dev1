import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Image as ImageIcon, ImagePlus, Search, Trash2, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { imagesApi } from '@/api/services'
import type { ImageSearchResult } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { resizeImageFile } from '@/lib/resizeImage'

const SEARCH_PAGE_SIZE = 20
const MAX_GALLERY = 8

/**
 * Multi-photo picker for rooms/suites — same Smart Image Finder layout as
 * CatalogItemImageField (side), but tapping a result adds to the gallery.
 */
export function CatalogItemGalleryField({
  imageUrls,
  onChange,
  disabled,
  name,
}: {
  imageUrls: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  name?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [searchOpen, setSearchOpen] = useState(true)
  const [query, setQuery] = useState(name?.trim() || '')
  const [searching, setSearching] = useState(false)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [results, setResults] = useState<ImageSearchResult[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  const cover = imageUrls[Math.min(activeIndex, Math.max(imageUrls.length - 1, 0))] ?? null
  const full = imageUrls.length >= MAX_GALLERY

  useEffect(() => {
    if (!query.trim() && name?.trim()) {
      setQuery(name.trim())
    }
  }, [name, query])

  useEffect(() => {
    if (activeIndex >= imageUrls.length) {
      setActiveIndex(Math.max(0, imageUrls.length - 1))
    }
  }, [imageUrls.length, activeIndex])

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    if (full) {
      toast.error(`You can add up to ${MAX_GALLERY} photos`)
      return
    }
    try {
      const next = [...imageUrls]
      for (const file of files) {
        if (next.length >= MAX_GALLERY) break
        if (!file.type.startsWith('image/')) continue
        next.push(await resizeImageFile(file, 640, 0.82))
      }
      if (next.length === imageUrls.length) {
        toast.error('Please choose an image file')
        return
      }
      onChange(next)
      setActiveIndex(next.length - 1)
      setSelectedId(null)
      toast.success('Photo uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not process image')
    }
  }

  async function runSearch() {
    const q = query.trim()
    if (!q || disabled) return
    setSearching(true)
    setSelectedId(null)
    try {
      const response = await imagesApi.search(q, SEARCH_PAGE_SIZE)
      setResults(response.results)
      if (response.results.length === 0) {
        toast.message('No photos found. Try another word.')
      }
    } catch (err) {
      setResults([])
      toast.error(err instanceof Error ? err.message : 'Photo search failed')
    } finally {
      setSearching(false)
    }
  }

  async function useResult(result: ImageSearchResult) {
    if (disabled || importingId) return
    if (full) {
      toast.error(`You can add up to ${MAX_GALLERY} photos`)
      return
    }
    setImportingId(result.id)
    setSelectedId(result.id)
    try {
      let nextUrl: string
      try {
        nextUrl = await imagesApi.importFromUrl(result.imageUrl)
      } catch {
        nextUrl = result.imageUrl
      }
      const next = [...imageUrls, nextUrl].slice(0, MAX_GALLERY)
      onChange(next)
      setActiveIndex(next.length - 1)
      toast.success('Photo added — save the item to keep it')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not use this photo')
      setSelectedId(null)
    } finally {
      setImportingId(null)
    }
  }

  function removeActive() {
    if (!imageUrls.length) return
    const index = Math.min(activeIndex, imageUrls.length - 1)
    const next = imageUrls.filter((_, i) => i !== index)
    onChange(next)
    setActiveIndex(Math.max(0, index - 1))
    setSelectedId(null)
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      className="hidden"
      disabled={disabled || full}
      onChange={onFile}
    />
  )

  const actionButtons = (
    <div className="flex w-full flex-wrap gap-2">
      {fileInput}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || full}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="size-4" />
        Upload from device
      </Button>
      <Button
        type="button"
        variant={searchOpen ? 'default' : 'outline'}
        size="sm"
        disabled={disabled}
        onClick={() => setSearchOpen((open) => !open)}
      >
        <Search className="size-4" />
        Search free photos
      </Button>
      {imageUrls.length > 0 ? (
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={removeActive}>
          <Trash2 className="size-4" />
          Remove
        </Button>
      ) : null}
    </div>
  )

  const resultsGrid = results.length > 0 ? (
    <>
      <p className="text-xs text-muted-foreground">
        Tap a photo to add it ({imageUrls.length}/{MAX_GALLERY}).
      </p>
      <div className="catalog-image-results grid grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 flex-1 min-h-[220px] max-h-[min(58vh,520px)]">
        {results.map((result) => {
          const busy = importingId === result.id
          const selected = selectedId === result.id
          return (
            <button
              key={result.id}
              type="button"
              disabled={disabled || Boolean(importingId) || full}
              className={`relative overflow-hidden rounded-lg border aspect-square disabled:opacity-60 ${
                selected ? 'border-primary ring-2 ring-primary/40' : 'border-border'
              }`}
              onClick={() => void useResult(result)}
              title={result.alt || result.photographer || 'Add this photo'}
            >
              <img src={result.thumbUrl} alt={result.alt || ''} className="size-full object-cover" />
              {busy ? (
                <span className="absolute inset-0 grid place-items-center bg-black/45 text-white">
                  <Loader2 className="size-4 animate-spin" />
                </span>
              ) : selected ? (
                <span className="absolute top-1.5 right-1.5 rounded-full bg-primary p-1 text-primary-foreground">
                  <Check className="size-3" />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </>
  ) : (
    <p className="text-xs text-muted-foreground">
      Search for a room or suite look, tap results to build the gallery, then save.
    </p>
  )

  return (
    <div className="catalog-image-side flex h-full min-h-0 flex-col gap-3">
      <div className="catalog-image-top">
        <div className="catalog-image-preview relative">
          {cover ? (
            <img
              src={cover}
              alt={name ? `${name} preview` : 'Room preview'}
              className="size-full object-cover"
            />
          ) : (
            <div className="catalog-image-empty" aria-hidden="true">
              <ImageIcon className="catalog-image-empty-icon" />
            </div>
          )}
          {imageUrls.length > 0 ? (
            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
              {activeIndex === 0 ? 'Cover' : `Photo ${activeIndex + 1}`} · {imageUrls.length}/{MAX_GALLERY}
            </span>
          ) : null}
        </div>
        {imageUrls.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {imageUrls.map((url, index) => (
              <button
                key={`${index}-${url.slice(0, 24)}`}
                type="button"
                className={`relative h-14 w-16 shrink-0 overflow-hidden rounded-lg border ${
                  index === activeIndex ? 'border-primary ring-2 ring-primary/40' : 'border-border'
                }`}
                onClick={() => setActiveIndex(index)}
                aria-label={`Show photo ${index + 1}`}
              >
                <img src={url} alt="" className="size-full object-cover" />
                {index === 0 ? (
                  <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] text-white">
                    Cover
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
        <div className="catalog-image-actions">{actionButtons}</div>
      </div>

      {searchOpen ? (
        <div className="smart-image-finder grid min-h-0 flex-1 gap-3 rounded-2xl border border-border bg-card p-3">
          <p className="smart-image-finder-title">Smart image finder</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="search"
              className="flex-1"
              value={query}
              disabled={disabled || searching}
              placeholder="e.g. hotel suite, king bed, lobby"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void runSearch()
                }
              }}
            />
            <Button
              type="button"
              disabled={disabled || searching || !query.trim()}
              onClick={() => void runSearch()}
            >
              {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Find
            </Button>
          </div>
          {resultsGrid}
          <p className="text-[11px] text-muted-foreground">
            Photos from{' '}
            <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="underline">
              Pexels
            </a>
            .
          </p>
        </div>
      ) : null}
    </div>
  )
}

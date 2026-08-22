import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Image as ImageIcon, ImagePlus, Search, Trash2, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { imagesApi } from '@/api/services'
import type { ImageSearchResult } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getCategoryImage } from '@/lib/categoryImages'
import { resizeImageFile } from '@/lib/resizeImage'

const SEARCH_PAGE_SIZE = 20

export function CatalogItemImageField({
  imageUrl,
  category,
  name,
  onChange,
  disabled,
  layout = 'stack',
}: {
  imageUrl?: string | null
  category?: string
  name?: string
  onChange: (next: string | null) => void
  disabled?: boolean
  /** `side` = page layout with preview + Smart Image Finder */
  layout?: 'stack' | 'side'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [searchOpen, setSearchOpen] = useState(true)
  const [query, setQuery] = useState(name?.trim() || '')
  const [searching, setSearching] = useState(false)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [results, setResults] = useState<ImageSearchResult[]>([])

  const side = layout === 'side'
  const preview = imageUrl || (side ? null : getCategoryImage(category || 'all'))

  useEffect(() => {
    if (!query.trim() && name?.trim()) {
      setQuery(name.trim())
    }
  }, [name, query])

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    try {
      const dataUrl = await resizeImageFile(file, 640, 0.82)
      onChange(dataUrl)
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
    setImportingId(result.id)
    setSelectedId(result.id)
    try {
      const dataUrl = await imagesApi.importFromUrl(result.imageUrl)
      onChange(dataUrl)
      toast.success('Photo ready — save the item to keep it')
    } catch {
      try {
        onChange(result.imageUrl)
        toast.success('Photo linked — save the item to keep it')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not use this photo')
        setSelectedId(null)
      }
    } finally {
      setImportingId(null)
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      disabled={disabled}
      onChange={onFile}
    />
  )

  const actionButtons = (
    <div className={`flex flex-wrap gap-2 ${side ? 'w-full' : ''}`}>
      {fileInput}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
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
      {imageUrl ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => {
            onChange(null)
            setSelectedId(null)
          }}
        >
          <Trash2 className="size-4" />
          Remove
        </Button>
      ) : null}
    </div>
  )

  const resultsGrid = results.length > 0 ? (
    <>
      <p className="text-xs text-muted-foreground">Tap a photo to use it.</p>
      <div
        className={`grid gap-2 overflow-y-auto catalog-image-results ${
          side
            ? 'grid-cols-3 sm:grid-cols-4 flex-1 min-h-[220px] max-h-[min(58vh,520px)]'
            : 'grid-cols-4 sm:grid-cols-5 md:grid-cols-5 max-h-[40vh]'
        }`}
      >
        {results.map((result) => {
          const busy = importingId === result.id
          const selected = selectedId === result.id || (imageUrl != null && selectedId === result.id)
          return (
            <button
              key={result.id}
              type="button"
              disabled={disabled || Boolean(importingId)}
              className={`relative overflow-hidden rounded-lg border aspect-square disabled:opacity-60 ${
                selected ? 'border-primary ring-2 ring-primary/40' : 'border-border'
              }`}
              onClick={() => void useResult(result)}
              title={result.alt || result.photographer || 'Use this photo'}
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
      Search for what you sell, tap a result to attach it, then save the item.
    </p>
  )

  if (side) {
    return (
      <div className="catalog-image-side flex h-full min-h-0 flex-col gap-3">
        <div className="catalog-image-top">
          <div className="catalog-image-preview">
            {preview ? (
              <img
                src={preview}
                alt={name ? `${name} preview` : 'Item preview'}
                className="size-full object-cover"
              />
            ) : (
              <div className="catalog-image-empty" aria-hidden="true">
                <ImageIcon className="catalog-image-empty-icon" />
              </div>
            )}
          </div>
          <div className="catalog-image-actions">{actionButtons}</div>
        </div>

        {searchOpen ? (
          <div className="smart-image-finder rounded-2xl border border-border bg-card p-3 grid gap-3 flex-1 min-h-0">
            <p className="smart-image-finder-title">Smart image finder</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="search"
                className="flex-1"
                value={query}
                disabled={disabled || searching}
                placeholder="e.g. coke, burger, fries"
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
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <Label>Item photo</Label>
      <div className="overflow-hidden rounded-xl border border-border bg-muted/30 max-w-md">
        <img
          src={preview}
          alt={name ? `${name} preview` : 'Item preview'}
          className="aspect-[4/3] w-full object-cover"
        />
      </div>
      {actionButtons}
      {searchOpen ? (
        <div className="rounded-xl border border-border bg-muted/20 p-4 grid gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="search"
              className="flex-1"
              value={query}
              disabled={disabled || searching}
              placeholder="e.g. coke, burger, fries"
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
              Find photos
            </Button>
          </div>
          {resultsGrid}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">Customers see this photo on the menu grid.</p>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The dense table.
 *
 * ## Why a column is a function
 *
 * A table that switches on a fixed set of column keys renders an
 * empty cell for anything it did not recognise. That looks like a generalised
 * component and is not one: adding a column meant editing the component, and a
 * column the component had not heard of failed silently — the worst possible
 * failure, because a blank cell reads as "no data" rather than "not
 * implemented".
 *
 * Here a column *is* its renderer. There is no vocabulary for the table to know
 * and nothing to fall through.
 *
 * ## Windowing
 *
 * The event log runs to several hundred rows. Rendered whole that is
 * thirty-one thousand DOM nodes, and clicking a filter took two seconds to
 * settle — which in a live walk-through does not read as "a large dataset", it
 * reads as "the product is slow".
 *
 * So rows outside the viewport are not rendered, and their space is held by two
 * spacer rows. §19.2 asks for this above fifty rows; the threshold below is
 * where the cost of windowing stops being worth paying.
 *
 * ## Pinning
 *
 * §19.3 is unforgiving about this. At the 1280px functional minimum the rail
 * leaves about 1,048px of content, the worklist declares a dozen
 * columns, and a 500px drawer can open over the same region — so the identity
 * column and the status column have to stay put while the rest scrolls. The
 * scroll is contained; the page body never moves sideways.
 */

export interface ColumnDef<T> {
  key: string
  header: string
  /** CSS width for the column. Numbers align better with a fixed track. */
  width?: string
  align?: 'left' | 'right'
  /** Tabular figures, so digits line up down the column. */
  numeric?: boolean
  /** Sticks to an edge while the rest of the table scrolls under it. */
  pinned?: 'left' | 'right'
  /** Providing a sort value is what makes a column sortable. */
  sortValue?: (row: T) => string | number
  render: (row: T) => ReactNode
}

export interface DataTableProps<T> {
  /** Names the scroll container for the verification protocol. */
  name: string
  rows: T[]
  columns: ColumnDef<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  /** Shown in place of the body when there is nothing to render. */
  empty?: ReactNode
  /** Caps the table's height and turns on windowing. */
  maxHeight?: number
  className?: string
}

/** Matches --row-height. Windowing needs a row height it can trust. */
const ROW_H = 44
const OVERSCAN = 8
const WINDOW_THRESHOLD = 50

type SortState = { key: string; dir: 'asc' | 'desc' } | null

export function DataTable<T>({
  name, rows, columns, rowKey, onRowClick, empty, maxHeight, className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(maxHeight ?? 0)
  /* On a phone two pinned columns can eat the whole width and the middle
   * columns collapse to nothing. Below 640px the table scrolls as one piece. */
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = viewport.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 640))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = col.sortValue!(a)
      const y = col.sortValue!(b)
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * factor
      return String(x).localeCompare(String(y)) * factor
    })
  }, [rows, columns, sort])

  /* Sticky offsets are cumulative: the second pinned column has to sit at the
   * width of the first, not at zero, or they stack on top of each other. */
  const leftOffsets = useMemo(() => {
    const out: Record<string, string> = {}
    let acc = 0
    for (const c of columns) {
      if (c.pinned !== 'left') continue
      out[c.key] = `${acc}px`
      acc += parseInt(c.width ?? '160', 10)
    }
    return out
  }, [columns])

  const rightOffsets = useMemo(() => {
    const out: Record<string, string> = {}
    let acc = 0
    for (const c of [...columns].reverse()) {
      if (c.pinned !== 'right') continue
      out[c.key] = `${acc}px`
      acc += parseInt(c.width ?? '160', 10)
    }
    return out
  }, [columns])

  /**
   * The declared widths have to become a floor, not a suggestion.
   *
   * A `width: 100%` table compresses columns below whatever a `<th>` asks for,
   * so fourteen declared columns quietly become fourteen squeezed ones and the
   * table never overflows — which means the pinned columns never do anything
   * and the one thing §19.3 asks for cannot be demonstrated. Summing the
   * declared widths into a `min-width` is what makes the scroll real.
   */
  const minWidth = useMemo(
    () => columns.reduce((n, c) => n + parseInt(c.width ?? '160', 10), 0),
    [columns],
  )

  const windowed = !!maxHeight && sorted.length > WINDOW_THRESHOLD

  useEffect(() => {
    const el = viewport.current
    if (!el || !windowed) return
    const onScroll = () => setScrollTop(el.scrollTop)
    setViewportH(el.clientHeight)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [windowed])

  /* Reset to the top when the row set changes, or a filter leaves the reader
   * scrolled past the end of a shorter list looking at nothing. */
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0
    setScrollTop(0)
  }, [rows])

  const start = windowed ? Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN) : 0
  const end = windowed
    ? Math.min(sorted.length, Math.ceil((scrollTop + (viewportH || ROW_H * 20)) / ROW_H) + OVERSCAN)
    : sorted.length
  const visible = windowed ? sorted.slice(start, end) : sorted

  function toggleSort(key: string) {
    setSort((s) =>
      s?.key !== key ? { key, dir: 'asc' }
      : s.dir === 'asc' ? { key, dir: 'desc' }
      : null,
    )
  }

  const stickyClass = (c: ColumnDef<T>) => narrow ? '' :
    c.pinned === 'left'
      ? 'sticky z-20 bg-surface after:absolute after:inset-y-0 after:-right-px after:w-px after:bg-border'
      : c.pinned === 'right'
        ? 'sticky z-20 bg-surface before:absolute before:inset-y-0 before:-left-px before:w-px before:bg-border'
        : ''

  const stickyStyle = (c: ColumnDef<T>) => narrow ? undefined :
    c.pinned === 'left' ? { left: leftOffsets[c.key] }
    : c.pinned === 'right' ? { right: rightOffsets[c.key] }
    : undefined

  return (
    <div
      ref={viewport}
      data-x-scroll={name}
      style={maxHeight ? { maxHeight } : undefined}
      className={cn(
        'border-structural-border bg-surface overflow-x-auto overscroll-x-contain rounded-lg border [contain:inline-size]',
        maxHeight && 'overflow-y-auto',
        className,
      )}
    >
      <table
        className="w-full border-collapse text-sm"
        style={{ minWidth: `${minWidth}px`, tableLayout: 'fixed' }}
      >
        <thead>
          <tr className="border-border border-b">
            {columns.map((c) => {
              const active = sort?.key === c.key
              const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown
              return (
                <th
                  key={c.key}
                  scope="col"
                  style={{ width: c.width, ...stickyStyle(c) }}
                  /* `none` rather than absent on the unsorted-but-sortable
                     columns. §19.1 asks tables to expose sort state, and an
                     omitted attribute tells a screen-reader user nothing about
                     whether the column can be sorted at all — they would have to
                     sort one to discover the rest were sortable. */
                  aria-sort={
                    active ? (sort.dir === 'asc' ? 'ascending' : 'descending')
                    : c.sortValue ? 'none'
                    : undefined
                  }
                  className={cn(
                    'bg-surface text-muted-foreground px-3 py-2 text-2xs font-medium tracking-wide uppercase',
                    c.align === 'right' || c.numeric ? 'text-right' : 'text-left',
                    stickyClass(c),
                    c.pinned ? 'z-30' : 'z-10',
                    maxHeight && 'sticky top-0',
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        'focus-visible:ring-ring hover:text-foreground inline-flex items-center gap-1 rounded-md',
                        'focus-visible:ring-2 focus-visible:outline-none',
                        c.align === 'right' || c.numeric ? 'flex-row-reverse' : '',
                        active && 'text-foreground',
                      )}
                    >
                      {c.header}
                      <Icon className="size-3 shrink-0" aria-hidden />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-muted-foreground px-3 py-10 text-center text-sm">
                {empty ?? 'Nothing to show.'}
              </td>
            </tr>
          ) : (
            <>
            {start > 0 && <tr aria-hidden style={{ height: start * ROW_H }} />}
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onRowClick(row)
                        }
                      }
                    : undefined
                }
                className={cn(
                  'border-border border-b last:border-b-0',
                  onRowClick && 'hover:bg-hover-tint focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:outline-none',
                )}
                style={{ height: 'var(--row-height)' }}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={stickyStyle(c)}
                    className={cn(
                      'px-3 py-1.5 align-middle',
                      c.align === 'right' || c.numeric ? 'text-right' : 'text-left',
                      c.numeric && 'tabular',
                      stickyClass(c),
                      /* The pinned cell inherits the row's hover, or it floats
                         disconnected from the row it belongs to. */
                      c.pinned && onRowClick && 'group-hover:bg-hover-tint',
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {end < sorted.length && <tr aria-hidden style={{ height: (sorted.length - end) * ROW_H }} />}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { TabsList } from '@/components/ui/tabs'

/** The share of the visible width one press of a scroll button moves the tabs by. */
const SCROLL_STEP = 0.8

/**
 * A tab list on one line that scrolls sideways. While its tabs overflow, a button at each end
 * scrolls them into view. Goes inside a `Tabs`, in place of `TabsList`.
 */
export function ScrollableTabsList({
  children,
  'aria-label': ariaLabel,
}: {
  children: ReactNode
  'aria-label': string
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [canScrollBack, setCanScrollBack] = useState(false)
  const [canScrollForward, setCanScrollForward] = useState(false)

  useEffect(() => {
    const list = listRef.current
    if (list === null) {
      return undefined
    }
    const measure = () => {
      setCanScrollBack(list.scrollLeft > 0)
      // Scroll offsets are fractional on scaled displays, so the end is reached within a pixel.
      setCanScrollForward(list.scrollLeft + list.clientWidth < list.scrollWidth - 1)
    }
    // The resize observer reports once on observing, which takes the first measurement. The list's
    // own box keeps its size as tabs are added, so additions are watched separately.
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(list)
    const mutationObserver = new MutationObserver(measure)
    mutationObserver.observe(list, { childList: true })
    list.addEventListener('scroll', measure, { passive: true })
    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      list.removeEventListener('scroll', measure)
    }
  }, [])

  const scroll = (direction: -1 | 1) => {
    const list = listRef.current
    list?.scrollBy({ left: direction * list.clientWidth * SCROLL_STEP, behavior: 'smooth' })
  }

  const overflows = canScrollBack || canScrollForward
  return (
    <div className="flex min-w-0 items-center gap-1">
      {overflows && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Scroll tabs back"
          disabled={!canScrollBack}
          onClick={() => scroll(-1)}
        >
          <ChevronLeft />
        </Button>
      )}
      <TabsList
        ref={listRef}
        aria-label={ariaLabel}
        className="w-auto min-w-0 flex-1 justify-start overflow-x-auto scrollbar-none"
      >
        {children}
      </TabsList>
      {overflows && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Scroll tabs forward"
          disabled={!canScrollForward}
          onClick={() => scroll(1)}
        >
          <ChevronRight />
        </Button>
      )}
    </div>
  )
}

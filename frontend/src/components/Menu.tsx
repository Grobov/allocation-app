import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

export interface MenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
}

interface MenuProps {
  /** Accessible name of the trigger button, e.g. "Actions for Payment Gateway". */
  label: string
  items: MenuItem[]
}

/** "⋯" dropdown menu following the WAI-ARIA menu button pattern. */
export function Menu({ label, items }: MenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    itemRefs.current[0]?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const close = (restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const nodes = itemRefs.current.filter((n): n is HTMLButtonElement => n !== null)
    const index = nodes.indexOf(document.activeElement as HTMLButtonElement)
    const focusAt = (i: number) => nodes[(i + nodes.length) % nodes.length]?.focus()
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusAt(index + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusAt(index - 1)
        break
      case 'Home':
        event.preventDefault()
        focusAt(0)
        break
      case 'End':
        event.preventDefault()
        focusAt(nodes.length - 1)
        break
      case 'Escape':
        event.preventDefault()
        close()
        break
      case 'Tab':
        close(false)
        break
    }
  }

  return (
    <div className="project-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="icon-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </button>
      {open && (
        <div
          id={menuId}
          className="project-menu-pop"
          role="menu"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(node) => {
                itemRefs.current[index] = node
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={item.danger ? 'danger-item' : undefined}
              onClick={() => {
                close(false)
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

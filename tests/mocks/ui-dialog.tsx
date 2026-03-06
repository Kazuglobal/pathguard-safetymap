import * as React from 'react'

type DialogContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  setOpen: () => undefined,
})

function withChildClick(
  child: React.ReactElement,
  onClick: () => void
) {
  const childProps = child.props as { onClick?: React.MouseEventHandler }
  return React.cloneElement(child, {
    onClick: (event: React.MouseEvent) => {
      childProps.onClick?.(event)
      onClick()
    },
  })
}

export function Dialog({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const isControlled = open !== undefined
  const resolvedOpen = isControlled ? open : internalOpen

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen)
      }
      onOpenChange?.(nextOpen)
    },
    [isControlled, onOpenChange]
  )

  return (
    <DialogContext.Provider value={{ open: resolvedOpen, setOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

export function DialogTrigger({
  asChild,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
  children: React.ReactNode
}) {
  const { setOpen } = React.useContext(DialogContext)
  if (asChild && React.isValidElement(children)) {
    return withChildClick(children, () => setOpen(true))
  }
  return (
    <button type="button" {...props} onClick={() => setOpen(true)}>
      {children}
    </button>
  )
}

export function DialogPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function DialogOverlay(
  props: React.HTMLAttributes<HTMLDivElement>
) {
  const { open } = React.useContext(DialogContext)
  if (!open) return null
  return <div data-testid="dialog-overlay" {...props} />
}

export function DialogClose({
  asChild,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
  children: React.ReactNode
}) {
  const { setOpen } = React.useContext(DialogContext)
  if (asChild && React.isValidElement(children)) {
    return withChildClick(children, () => setOpen(false))
  }
  return (
    <button type="button" {...props} onClick={() => setOpen(false)}>
      {children}
    </button>
  )
}

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function DialogContent({ children, ...props }, ref) {
  const { open } = React.useContext(DialogContext)
  if (!open) return null
  return (
    <div ref={ref} role="dialog" {...props}>
      {children}
    </div>
  )
})

export function DialogHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />
}

export function DialogFooter(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />
}

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function DialogTitle(props, ref) {
  return <h2 ref={ref} {...props} />
})

export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function DialogDescription(props, ref) {
  return <p ref={ref} {...props} />
})

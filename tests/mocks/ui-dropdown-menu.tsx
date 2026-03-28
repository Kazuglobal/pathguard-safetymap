import * as React from 'react'

type DropdownMenuContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue>({
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

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      {children}
    </DropdownMenuContext.Provider>
  )
}

export function DropdownMenuTrigger({
  asChild,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
  children: React.ReactNode
}) {
  const { open, setOpen } = React.useContext(DropdownMenuContext)
  if (asChild && React.isValidElement(children)) {
    return withChildClick(children, () => setOpen(!open))
  }
  return (
    <button type="button" {...props} onClick={() => setOpen(!open)}>
      {children}
    </button>
  )
}

export function DropdownMenuContent({
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = React.useContext(DropdownMenuContext)
  if (!open) return null
  return <div role="menu" {...props}>{children}</div>
}

export const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean }
>(function DropdownMenuItem({ children, ...props }, ref) {
  return (
    <button ref={ref} type="button" role="menuitem" {...props}>
      {children}
    </button>
  )
})

export const DropdownMenuCheckboxItem = DropdownMenuItem
export const DropdownMenuRadioItem = DropdownMenuItem

export function DropdownMenuLabel(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />
}

export function DropdownMenuSeparator(props: React.HTMLAttributes<HTMLHRElement>) {
  return <hr {...props} />
}

export function DropdownMenuShortcut(props: React.HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} />
}

export function DropdownMenuGroup({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function DropdownMenuPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function DropdownMenuSub({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export const DropdownMenuSubContent = DropdownMenuContent
export const DropdownMenuSubTrigger = DropdownMenuItem

export function DropdownMenuRadioGroup({
  children,
}: {
  children: React.ReactNode
}) {
  return <div>{children}</div>
}

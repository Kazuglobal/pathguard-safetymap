import * as React from "react"

/**
 * Test double for components/ui/dropdown-menu.
 *
 * Radix's real DropdownMenu renders its content in a portal that only mounts
 * while the menu is open, which makes jsdom-based tests brittle (they would have
 * to open the menu before every item can be queried). This mock renders the menu
 * content inline and always, so `getByTestId('edit-route-button')` and friends
 * resolve without simulating a pointer open. Item clicks are forwarded through a
 * plain button, mirroring how Radix items dispatch onClick/onSelect on activation.
 */

type Children = { children?: React.ReactNode }

const Fragment = ({ children }: Children) => <>{children}</>

export const DropdownMenu = Fragment
export const DropdownMenuGroup = Fragment
export const DropdownMenuPortal = Fragment
export const DropdownMenuSub = Fragment
export const DropdownMenuSubContent = Fragment
export const DropdownMenuSubTrigger = Fragment
export const DropdownMenuRadioGroup = Fragment
export const DropdownMenuContent = Fragment

export const DropdownMenuTrigger = ({
  children,
  asChild,
  ...props
}: Children & { asChild?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) =>
  asChild ? (
    <>{children}</>
  ) : (
    <button type="button" {...props}>
      {children}
    </button>
  )

type ItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  onSelect?: (event: unknown) => void
  inset?: boolean
  asChild?: boolean
}

const MenuItem = React.forwardRef<HTMLButtonElement, ItemProps>(
  ({ children, onClick, onSelect, inset, asChild, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      onClick={(event) => {
        onClick?.(event)
        onSelect?.(event)
      }}
      {...props}
    >
      {children}
    </button>
  )
)
MenuItem.displayName = "DropdownMenuItem"

export const DropdownMenuItem = MenuItem
export const DropdownMenuCheckboxItem = MenuItem
export const DropdownMenuRadioItem = MenuItem

export const DropdownMenuLabel = ({
  children,
  inset,
  ...props
}: Children & { inset?: boolean } & React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props}>{children}</div>
)

export const DropdownMenuSeparator = (
  props: React.HTMLAttributes<HTMLHRElement>
) => <hr {...props} />

export const DropdownMenuShortcut = ({
  children,
  ...props
}: Children & React.HTMLAttributes<HTMLSpanElement>) => (
  <span {...props}>{children}</span>
)

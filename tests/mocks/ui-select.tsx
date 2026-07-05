import * as React from 'react'

type SelectContextValue = {
  value: string
  setValue: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}

const SelectContext = React.createContext<SelectContextValue>({
  value: '',
  setValue: () => undefined,
  open: false,
  setOpen: () => undefined,
})

export function Select({
  value,
  defaultValue = '',
  onValueChange,
  children,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)
  const resolvedValue = value ?? internalValue

  const setValue = React.useCallback(
    (nextValue: string) => {
      if (value === undefined) {
        setInternalValue(nextValue)
      }
      onValueChange?.(nextValue)
      setOpen(false)
    },
    [onValueChange, value]
  )

  return (
    <SelectContext.Provider value={{ value: resolvedValue, setValue, open, setOpen }}>
      <div data-testid="mock-select">{children}</div>
    </SelectContext.Provider>
  )
}

export function SelectGroup({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function SelectValue({ placeholder }: { placeholder?: React.ReactNode }) {
  const { value } = React.useContext(SelectContext)
  return <span>{value || placeholder || null}</span>
}

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function SelectTrigger({ children, ...props }, ref) {
  const { open, setOpen } = React.useContext(SelectContext)
  return (
    <button
      ref={ref}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      {...props}
      onClick={() => setOpen(!open)}
    >
      {children}
    </button>
  )
})

export function SelectContent({
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  // Radix の SelectContent は開いている間だけポータルに描画されるが、jsdom テストでは
  // 選択肢を検証する前にトリガーを開く操作が必須になり脆くなる。ui-dropdown-menu モックと
  // 同様に選択肢を常時インライン描画し、getByRole('option') 等が開閉操作なしで解決するようにする。
  return (
    <div role="listbox" {...props}>
      {children}
    </div>
  )
}

export function SelectLabel(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />
}

export const SelectItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(function SelectItem({ children, value, ...props }, ref) {
  const { value: selectedValue, setValue } = React.useContext(SelectContext)
  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={selectedValue === value}
      {...props}
      onClick={() => setValue(value)}
    >
      {children}
    </button>
  )
})

export function SelectSeparator(props: React.HTMLAttributes<HTMLHRElement>) {
  return <hr {...props} />
}

export function SelectScrollUpButton({
  children,
}: {
  children?: React.ReactNode
}) {
  return <>{children}</>
}

export function SelectScrollDownButton({
  children,
}: {
  children?: React.ReactNode
}) {
  return <>{children}</>
}

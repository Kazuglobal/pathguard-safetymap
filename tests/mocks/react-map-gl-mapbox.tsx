import React from "react"

type GenericProps = React.PropsWithChildren<Record<string, unknown>>

const Map = React.forwardRef<HTMLDivElement, GenericProps>(function MockMap(
  { children, ...props },
  ref,
) {
  return (
    <div ref={ref} data-testid="mock-react-map-gl-map" {...props}>
      {children}
    </div>
  )
})

export function Source({ children }: GenericProps) {
  return <>{children}</>
}

export function Layer() {
  return null
}

export function Popup({ children }: GenericProps) {
  return <div data-testid="mock-react-map-gl-popup">{children}</div>
}

export function NavigationControl() {
  return <div data-testid="mock-react-map-gl-navigation-control" />
}

export function useMap() {
  return {}
}

export type MapRef = unknown
export type MapMouseEvent = unknown
export type MapTouchEvent = unknown

export default Map

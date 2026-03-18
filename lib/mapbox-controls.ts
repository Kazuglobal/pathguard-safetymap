export function shouldShowMapNavigationControl(isMobile: boolean) {
  return !isMobile
}

interface MapControlHost<TControl> {
  hasControl(control: TControl): boolean
  addControl(control: TControl, position: "bottom-right"): void
  removeControl(control: TControl): void
}

export function syncMapNavigationControl<TControl>({
  map,
  control,
  shouldShow,
}: {
  map: MapControlHost<TControl>
  control: TControl
  shouldShow: boolean
}) {
  const isMounted = map.hasControl(control)

  if (shouldShow && !isMounted) {
    map.addControl(control, "bottom-right")
    return
  }

  if (!shouldShow && isMounted) {
    map.removeControl(control)
  }
}

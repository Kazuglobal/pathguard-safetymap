export function getAccidentHeatmapControlContainerClass(isMobile: boolean) {
  if (isMobile) {
    return 'absolute left-3 z-10 top-[calc(env(safe-area-inset-top,0px)+4.25rem)]'
  }

  return 'absolute left-3 z-10 bottom-[calc(env(safe-area-inset-bottom,0px)+2rem)] sm:left-auto sm:right-3 sm:bottom-6'
}

export function shouldRenderAccidentHeatmapControl({
  isMobile,
  awaitingLocationSelection,
  isReportFormOpen,
}: {
  isMobile: boolean
  awaitingLocationSelection: boolean
  isReportFormOpen: boolean
}) {
  if (!isMobile) {
    return !awaitingLocationSelection
  }

  return !isReportFormOpen
}

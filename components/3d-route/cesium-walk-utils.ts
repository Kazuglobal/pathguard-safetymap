export function getNextWalkIndex(currentIndex: number, routeLength: number): number {
  if (routeLength <= 1) {
    return 0
  }
  return (currentIndex + 1) % routeLength
}


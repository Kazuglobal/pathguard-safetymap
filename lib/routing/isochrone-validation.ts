/** Validate all caller-controlled fanout before reserving paid API units. */
export function validCoordinates(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) &&
    Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90
}

export function validContours(value: unknown): value is number[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 4 &&
    value.every((n, i) => Number.isInteger(n) && n >= 1 && n <= 60 && (i === 0 || n > value[i - 1]))
}

export function validLocations(value: unknown): boolean {
  return Array.isArray(value) && value.length >= 1 && value.length <= 10 &&
    value.every(item => item && typeof item === 'object' && validCoordinates(item.coordinates))
}

export function validServiceTypes(value: unknown): boolean {
  return Array.isArray(value) && value.length >= 1 && value.length <= 5 &&
    new Set(value).size === value.length &&
    value.every(type => ['hospital', 'school', 'shopping', 'transport', 'park'].includes(type))
}

export function isochroneCost(type: unknown, options: Record<string, unknown>): number | null {
  if (options.profile !== undefined &&
      (typeof options.profile !== 'string' || !['walking', 'cycling', 'driving'].includes(options.profile))) return null
  switch (type) {
    case 'generateIsochrone':
      return validCoordinates(options.center) && validContours(options.contours) ? 1 : null
    case 'batchGenerateIsochrones':
    case 'compareReachability': {
      const contours = type === 'compareReachability' && options.contours === undefined ? [10, 15, 20] : options.contours
      return validLocations(options.locations) && validContours(contours) ? (options.locations as unknown[]).length : null
    }
    case 'analyzeSchoolZone':
      return validCoordinates(options.schoolLocation) && typeof options.schoolName === 'string' && options.schoolName.trim() ? 1 : null
    case 'analyzeEvacuationZone': {
      const site = options.evacuationSite as Record<string, unknown> | null
      return site && validCoordinates(site.coordinates) ? 1 : null
    }
    case 'analyzeAccessibility': {
      const types = options.serviceTypes === undefined ? ['hospital', 'school', 'shopping'] : options.serviceTypes
      return validCoordinates(options.location) && validServiceTypes(types) ? 3 * (types as unknown[]).length : null
    }
    default:
      return null
  }
}

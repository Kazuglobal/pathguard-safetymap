export const MIN_LATITUDE = -90
export const MAX_LATITUDE = 90
export const MIN_LONGITUDE = -180
export const MAX_LONGITUDE = 180

export function isValidLatitude(latitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= MIN_LATITUDE && latitude <= MAX_LATITUDE
}

export function isValidLongitude(longitude: number): boolean {
  return Number.isFinite(longitude) && longitude >= MIN_LONGITUDE && longitude <= MAX_LONGITUDE
}

export function isValidCoordinates(latitude: number, longitude: number): boolean {
  return isValidLatitude(latitude) && isValidLongitude(longitude)
}

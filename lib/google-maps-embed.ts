import { OpenLocationCode } from 'open-location-code'
import { isValidCoordinates } from '@/lib/coordinates'

const locationCode = new OpenLocationCode()

/** These URLs use only the free Embed API, never the existing paid viewer key. */
export function buildGoogleMapsEmbedUrls(coordinates: [number, number], apiKey: string | undefined) {
  const [longitude, latitude] = coordinates
  const key = apiKey?.trim()
  if (!key || !isValidCoordinates(latitude, longitude)) return null

  const position = `${latitude},${longitude}`
  const shared = { key, language: 'ja', region: 'JP' }
  const map = new URL('https://www.google.com/maps/embed/v1/place')
  map.search = new URLSearchParams({
    ...shared,
    q: locationCode.encode(latitude, longitude, 11),
    center: position,
    zoom: '18',
    maptype: 'roadmap',
  }).toString()
  const streetView = new URL('https://www.google.com/maps/embed/v1/streetview')
  streetView.search = new URLSearchParams({
    ...shared, location: position, radius: '50', source: 'outdoor',
  }).toString()
  return { map: map.toString(), streetView: streetView.toString() }
}

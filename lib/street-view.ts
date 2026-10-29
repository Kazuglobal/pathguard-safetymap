import { calculateBearing, calculateDistance } from '@/lib/ar-utils'

export interface StreetViewTarget {
  coordinates: [number, number]
  properties: Record<string, unknown>
}

let loaderPromise: Promise<typeof google> | null = null

/** One loader configuration, matching the existing isolated 3D prototype. */
export async function loadStreetView(): Promise<typeof google> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!key) throw new Error('configuration')
  if (!loaderPromise) {
    loaderPromise = import('@googlemaps/js-api-loader').then(({ Loader }) =>
      new Loader({ apiKey: key, version: 'weekly' }).load(),
    ).catch(() => { loaderPromise = null; throw new Error('network') })
  }
  return loaderPromise
}

export function streetViewLocationInfo(target: [number, number], camera: { lat: number; lng: number }) {
  return {
    distance: calculateDistance(camera.lat, camera.lng, target[1], target[0]),
    heading: calculateBearing(camera.lat, camera.lng, target[1], target[0]),
  }
}

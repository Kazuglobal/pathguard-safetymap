import { getMapboxToken } from "@/lib/mapbox-config"
import { isValidCoordinates } from "@/lib/coordinates"

const REVERSE_GEOCODE_DECIMALS = 3

function toCoarseCoordinate(value: number, decimals = REVERSE_GEOCODE_DECIMALS): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export async function reverseGeocodeLocation(latitude: number, longitude: number) {
  const token = getMapboxToken()
  if (!token) {
    console.warn("Mapbox token is missing; skip reverse geocoding.")
    return { prefecture: null as string | null, city: null as string | null }
  }

  if (!isValidCoordinates(latitude, longitude)) {
    console.warn("Invalid coordinates for reverse geocoding", { latitude, longitude })
    return { prefecture: null as string | null, city: null as string | null }
  }

  // Send coarse coordinates (~100m) to reduce precise-location exposure to external services.
  const coarseLatitude = toCoarseCoordinate(latitude)
  const coarseLongitude = toCoarseCoordinate(longitude)

  try {
    const params = new URLSearchParams({
      access_token: token,
      language: "ja",
      types: "region,place,locality,district",
      limit: "5",
    })

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${coarseLongitude},${coarseLatitude}.json?${params.toString()}`,
    )

    if (!response.ok) {
      console.warn("Reverse geocoding request failed", response.status)
      return { prefecture: null, city: null }
    }

    const data = await response.json()
    const features: any[] = Array.isArray(data?.features) ? data.features : []

    let prefecture: string | null = null
    let city: string | null = null

    const processFeature = (feature: any) => {
      if (!feature) return
      const types: string[] = feature.place_type ?? []
      if (!prefecture && types.includes("region")) {
        prefecture = feature.text ?? feature.place_name ?? null
      }
      if (
        !city &&
        (types.includes("place") || types.includes("locality") || types.includes("district"))
      ) {
        city = feature.text ?? feature.place_name ?? null
      }
      if (Array.isArray(feature.context)) {
        feature.context.forEach(processFeature)
      }
    }

    features.forEach(processFeature)

    return { prefecture, city }
  } catch (error) {
    console.warn("Reverse geocoding lookup failed", error)
    return { prefecture: null, city: null }
  }
}

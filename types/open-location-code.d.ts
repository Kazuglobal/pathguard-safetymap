declare module 'open-location-code' {
  export class OpenLocationCode {
    encode(latitude: number, longitude: number, codeLength?: number): string
    decode(code: string): {
      latitudeLo: number
      latitudeHi: number
      longitudeLo: number
      longitudeHi: number
    }
  }
}

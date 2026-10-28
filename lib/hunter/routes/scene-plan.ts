/** Input is already placed in the route order confirmed by the creator.
 * A scene is one location, not the entire route. Never infer camera azimuth
 * from travel direction: these are different measurements.
 */
export interface RoutePhoto {
  id: string
  sceneId: string
  included: boolean
  maskingReviewed: boolean
}

export interface PlannedScene {
  sceneId: string
  photoIds: string[]
}

export function buildScenePlan(photos: readonly RoutePhoto[]): PlannedScene[] {
  const scenes: PlannedScene[] = []
  const seenPhotos = new Set<string>()
  const seenScenes = new Set<string>()
  for (const photo of photos) {
    if (!photo.included) continue
    if (!photo.id.trim() || !photo.sceneId.trim()) throw new Error('写真の撮影地点を確認してください')
    if (!photo.maskingReviewed) throw new Error('写真のマスキングを確認してください')
    if (seenPhotos.has(photo.id)) throw new Error('同じ写真が重複しています')
    seenPhotos.add(photo.id)
    let scene = scenes.at(-1)
    if (scene?.sceneId !== photo.sceneId) {
      if (seenScenes.has(photo.sceneId)) throw new Error('同じ地点の写真をまとめて順番を確認してください')
      seenScenes.add(photo.sceneId)
      scene = { sceneId: photo.sceneId, photoIds: [] }
      scenes.push(scene)
    }
    scene.photoIds.push(photo.id)
  }
  if (!scenes.length) throw new Error('共有する区間の写真を選んでください')
  return scenes
}

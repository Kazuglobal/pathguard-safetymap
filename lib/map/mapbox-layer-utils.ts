import type mapboxgl from "mapbox-gl"

// Mapbox GL のレイヤー/ソースを例外なく安全に追加・削除するヘルパー群。
// いずれも map インスタンスを明示的に受け取る純粋関数。

export const layerExists = (mapInstance: mapboxgl.Map, layerId: string): boolean => {
  try { return !!mapInstance.getLayer(layerId) } catch (e) { return false }
}

export const sourceExists = (mapInstance: mapboxgl.Map, sourceId: string): boolean => {
  try { return !!mapInstance.getSource(sourceId) } catch (e) { return false }
}

export const safeAddLayer = (mapInstance: mapboxgl.Map, layerId: string, layerConfig: any) => {
  if (!layerExists(mapInstance, layerId)) {
    try { mapInstance.addLayer(layerConfig); return true }
    catch (error) { console.error(`Error adding layer ${layerId}:`, error); return false }
  } return false
}

export const safeRemoveLayer = (mapInstance: mapboxgl.Map, layerId: string) => {
  if (layerExists(mapInstance, layerId)) {
    try { mapInstance.removeLayer(layerId); return true }
    catch (error) { console.error(`Error removing layer ${layerId}:`, error); return false }
  } return false
}

export const safeAddSource = (mapInstance: mapboxgl.Map, sourceId: string, sourceConfig: any) => {
  if (!sourceExists(mapInstance, sourceId)) {
    try { mapInstance.addSource(sourceId, sourceConfig); return true }
    catch (error) { console.error(`Error adding source ${sourceId}:`, error); return false }
  } return false
}

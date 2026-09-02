export type MaintenanceMode = 'read_only' | undefined

export function getMaintenanceMode(): MaintenanceMode {
  return process.env.MAINTENANCE_MODE === 'read_only' ? 'read_only' : undefined
}

export function isMaintenanceWriteRequest(
  method: string,
  mode: MaintenanceMode = getMaintenanceMode(),
): boolean {
  if (mode !== 'read_only') return false
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
}

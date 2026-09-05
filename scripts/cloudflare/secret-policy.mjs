export function isSensitiveBuildVariable(name) {
  const isPublic = name.startsWith('NEXT_PUBLIC_') || name.includes('ANON_KEY')
  if (isPublic) return false
  return name === 'UPSTASH_REDIS_REST_URL' ||
    /(?:API_KEY|AUTH_TOKEN|_TOKEN|PRIVATE_KEY|SECRET|SERVICE_ROLE)/.test(name)
}

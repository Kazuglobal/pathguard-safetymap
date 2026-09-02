import type { Actor } from '@/lib/db/authz'
import { writeHunterAuditLog } from '@/lib/db/repos/hunter.repo'

export async function writeAuditLog(actor: Actor, action: string, targetId: string): Promise<void> {
  try {
    await writeHunterAuditLog(actor, action, targetId)
  } catch (error) {
    console.error('監査ログの記録に失敗しました:', error instanceof Error ? error.message : 'unknown')
  }
}

import ThreeDRoutePocClient from './3d-route-poc-client'
import { requireAdminPage } from '@/lib/admin-auth'

export const metadata = { title: '3D通学路(試作・管理者用)' }

// 試作の画面なので、管理者だけが開ける(判定はサーバで。UIUX改装 項目53)
export default async function ThreeDRoutePocPage() {
  await requireAdminPage('/3d-route-poc')

  return <ThreeDRoutePocClient />
}

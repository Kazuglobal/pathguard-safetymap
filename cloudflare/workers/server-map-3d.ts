import { handler } from '../../.open-next/server-functions/map3d/handler.mjs'
import { createServerWorker } from './server-runtime'

export default createServerWorker(handler)

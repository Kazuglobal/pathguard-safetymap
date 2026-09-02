import { handler } from '../../.open-next/server-functions/routeList/handler.mjs'
import { createServerWorker } from './server-runtime'

export default createServerWorker(handler)

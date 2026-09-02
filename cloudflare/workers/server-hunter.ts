import { handler } from '../../.open-next/server-functions/hunter/handler.mjs'
import { createServerWorker } from './server-runtime'

export default createServerWorker(handler)

import { handler } from '../../.open-next/server-functions/core/handler.mjs'
import { createServerWorker } from './server-runtime'

export default createServerWorker(handler)

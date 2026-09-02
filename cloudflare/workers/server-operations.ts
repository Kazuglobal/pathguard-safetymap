import { handler } from '../../.open-next/server-functions/operations/handler.mjs'
import { createServerWorker } from './server-runtime'

export default createServerWorker(handler)

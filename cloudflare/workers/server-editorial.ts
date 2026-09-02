import { handler } from '../../.open-next/server-functions/editorial/handler.mjs'
import { createServerWorker } from './server-runtime'

export default createServerWorker(handler)

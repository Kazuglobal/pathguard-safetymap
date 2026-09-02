import { handler } from '../../.open-next/server-functions/community/handler.mjs'
import { createServerWorker } from './server-runtime'

export default createServerWorker(handler)

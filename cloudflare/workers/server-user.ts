import { handler } from '../../.open-next/server-functions/user/handler.mjs'
import { createServerWorker } from './server-runtime'

export default createServerWorker(handler)

import { handler } from '../../.open-next/server-functions/authAdmin/handler.mjs'
import { createServerWorker } from './server-runtime'

export default createServerWorker(handler)

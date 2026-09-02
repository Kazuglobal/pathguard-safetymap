import { handler } from '../../.open-next/server-functions/aiVision/handler.mjs'
import { createServerWorker } from './server-runtime'

export default createServerWorker(handler)

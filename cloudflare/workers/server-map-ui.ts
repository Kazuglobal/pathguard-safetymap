import { handler } from '../../.open-next/server-functions/mapUi/handler.mjs'
import { createServerWorker } from './server-runtime'

export default createServerWorker(handler)

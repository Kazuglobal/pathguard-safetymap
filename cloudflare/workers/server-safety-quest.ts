import { handler } from '../../.open-next/server-functions/safetyQuest/handler.mjs'
import { createServerWorker } from './server-runtime'

export default createServerWorker(handler)

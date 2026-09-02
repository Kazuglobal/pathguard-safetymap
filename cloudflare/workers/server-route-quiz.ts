import { handler } from '../../.open-next/server-functions/routeQuiz/handler.mjs'
import { createServerWorker } from './server-runtime'

export default createServerWorker(handler)

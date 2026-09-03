// Establish the router name before its service-bound servers are first deployed.
export default {
  fetch() {
    return new Response('Preview deployment in progress. Please retry shortly.', {
      status: 503,
      headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' },
    })
  },
}

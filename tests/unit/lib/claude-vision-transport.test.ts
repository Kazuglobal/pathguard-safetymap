// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { callClaudeVision } from '@/lib/claude-vision'

describe('Claude vision native fetch transport', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  it('sends the real SDK request through native fetch without a Node HTTP agent', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubEnv('CLAUDE_VISION_MODEL', '')
    const nativeFetch = vi.fn(async () => new Response(JSON.stringify({
      id: 'test-message', type: 'message', role: 'assistant', model: 'claude-haiku-5-5',
      content: [{ type: 'text', text: '{"hazards":[]}' }],
      stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    }), { headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', nativeFetch)
    await expect(callClaudeVision({ base64: 'AQID', mediaType: 'image/webp', prompt: 'Return JSON' })).resolves.toBe('{"hazards":[]}')
    expect(nativeFetch).toHaveBeenCalledOnce()
    const [url, options] = nativeFetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(options).not.toHaveProperty('agent')
    expect(JSON.parse(options.body as string)).toMatchObject({ model: 'claude-haiku-5-5', messages: [{ role: 'user', content: [{ type: 'image' }, { type: 'text' }] }] })
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { useEffect } from "react"
import type React from "react"
import { SafeMagazineCarousel } from "@/components/landing/safe-magazine-carousel"
import { getLandingSafeMagazinePreview } from "@/lib/landing-safe-magazine-preview"

const state = vi.hoisted(() => ({
  reduceMotion: false as boolean | null,
  api: null as unknown,
}))

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => state.reduceMotion,
}))

// Embla は jsdom ではレイアウトが取れずスナップが1つに潰れるため、
// setApi に偽の API を渡して自動スライドの制御ロジックだけを検証する。
vi.mock("@/components/ui/carousel", () => ({
  Carousel: ({
    children,
    setApi,
    opts: _opts,
    plugins: _plugins,
    ...props
  }: {
    children: React.ReactNode
    setApi?: (api: unknown) => void
    opts?: unknown
    plugins?: unknown
  }) => {
    useEffect(() => {
      setApi?.(state.api)
    }, [setApi])
    return (
      <div role="region" {...props}>
        {children}
      </div>
    )
  },
  CarouselContent: ({ children, ...props }: { children: React.ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  CarouselItem: ({ children, ...props }: { children: React.ReactNode }) => (
    <div role="group" {...props}>
      {children}
    </div>
  ),
}))

function createFakeApi() {
  const handlers = new Map<string, Set<() => void>>()
  const emit = (event: string) => handlers.get(event)?.forEach((handler) => handler())
  let playing = false
  let selected = 0

  const autoplay = {
    play: vi.fn(() => {
      playing = true
      emit("autoplay:play")
    }),
    stop: vi.fn(() => {
      playing = false
      emit("autoplay:stop")
    }),
    isPlaying: () => playing,
  }

  const api = {
    on: vi.fn((event: string, handler: () => void) => {
      handlers.set(event, (handlers.get(event) ?? new Set()).add(handler))
      return api
    }),
    off: vi.fn((event: string, handler: () => void) => {
      handlers.get(event)?.delete(handler)
      return api
    }),
    selectedScrollSnap: () => selected,
    scrollTo: vi.fn((index: number) => {
      selected = index
      emit("select")
    }),
    plugins: () => ({ autoplay }),
  }

  const select = (index: number) => {
    selected = index
    emit("select")
  }

  return { api, autoplay, select, handlers }
}

const articles = getLandingSafeMagazinePreview(6)

describe("SafeMagazineCarousel", () => {
  let fake: ReturnType<typeof createFakeApi>

  beforeEach(() => {
    fake = createFakeApi()
    state.api = fake.api
    state.reduceMotion = false
  })

  it("記事をすべてスライドとして並べ、記事ページへリンクする", () => {
    render(<SafeMagazineCarousel articles={articles} />)

    expect(screen.getByRole("region", { name: "PathGuard Press の新着記事" })).toBeInTheDocument()
    expect(screen.getAllByRole("group")).toHaveLength(articles.length)
    expect(screen.getByRole("link", { name: new RegExp(escapeRegExp(articles[0].title)) })).toHaveAttribute(
      "href",
      `/safe-magazine/${articles[0].slug}`,
    )
  })

  it("視差効果を減らす設定でなければ自動スライドを始め、止めるボタンを出す", () => {
    render(<SafeMagazineCarousel articles={articles} />)

    expect(fake.autoplay.play).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "自動スライドを止める" })).toBeInTheDocument()
  })

  it("止めるボタンで自動スライドを止め、再生ボタンに切り替わる", () => {
    render(<SafeMagazineCarousel articles={articles} />)

    fireEvent.click(screen.getByRole("button", { name: "自動スライドを止める" }))

    expect(fake.autoplay.stop).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "自動スライドを再生" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "自動スライドを再生" }))
    expect(fake.autoplay.play).toHaveBeenCalledTimes(2)
  })

  it("視差効果を減らす設定では自動スライドを始めない", () => {
    state.reduceMotion = true
    render(<SafeMagazineCarousel articles={articles} />)

    expect(fake.autoplay.play).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "自動スライドを再生" })).toBeInTheDocument()
  })

  it("表示中のスライドに合わせて丸ボタンの現在位置が変わる", () => {
    render(<SafeMagazineCarousel articles={articles} />)

    expect(screen.getByRole("button", { name: `1件目の記事を表示` })).toHaveAttribute("aria-current", "true")

    act(() => fake.select(2))

    expect(screen.getByRole("button", { name: `3件目の記事を表示` })).toHaveAttribute("aria-current", "true")
    expect(screen.getByRole("button", { name: `1件目の記事を表示` })).not.toHaveAttribute("aria-current")
  })

  it("丸ボタンで選んだ記事へ移動し、自動スライドは止める", () => {
    render(<SafeMagazineCarousel articles={articles} />)

    fireEvent.click(screen.getByRole("button", { name: `4件目の記事を表示` }))

    expect(fake.api.scrollTo).toHaveBeenCalledWith(3)
    expect(fake.autoplay.stop).toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "自動スライドを再生" })).toBeInTheDocument()
  })

  it("アンマウント時にイベント購読を外す", () => {
    const { unmount } = render(<SafeMagazineCarousel articles={articles} />)
    unmount()

    const remaining = [...fake.handlers.values()].reduce((sum, set) => sum + set.size, 0)
    expect(remaining).toBe(0)
  })
})

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

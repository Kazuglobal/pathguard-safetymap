import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { useEffect } from "react"
import type React from "react"
import { SafeMagazineCarousel } from "@/components/landing/safe-magazine-carousel"
import { getLandingSafeMagazinePreview } from "@/lib/landing-safe-magazine-preview"

const state = vi.hoisted(() => ({
  isMobileViewport: true,
  allowsMotion: true,
  api: null as unknown,
}))

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: (query: string) =>
    query.includes("prefers-reduced-motion") ? state.allowsMotion : state.isMobileViewport,
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
    <div data-testid="carousel-content" {...props}>
      {children}
    </div>
  ),
  CarouselItem: ({ children, ...props }: { children: React.ReactNode }) => (
    <div role="group" {...props}>
      {children}
    </div>
  ),
}))

/** embla-carousel-autoplay 8.6 と同じく、状態が変わるときだけ play/stop を発火する偽 API */
function createFakeApi(snapCount = 6) {
  const handlers = new Map<string, Set<() => void>>()
  const emit = (event: string) => handlers.get(event)?.forEach((handler) => handler())
  let playing = false
  let selected = 0

  const autoplay = {
    play: vi.fn(() => {
      if (!playing) emit("autoplay:play")
      playing = true
    }),
    stop: vi.fn(() => {
      if (playing) emit("autoplay:stop")
      playing = false
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
    scrollSnapList: () => Array.from({ length: snapCount }, (_, i) => i),
    scrollTo: vi.fn((index: number) => {
      selected = index
      emit("select")
    }),
    plugins: () => ({ autoplay }),
  }

  return {
    api,
    autoplay,
    handlers,
    isPlaying: () => playing,
    select: (index: number) => {
      selected = index
      emit("select")
    },
    pointerDown: () => {
      emit("pointerDown")
      autoplay.stop()
    },
    /** 回転・リサイズ時の reInit: プラグインを破棄して作り直す(playOnInit:false なので止まったまま) */
    reInit: () => {
      autoplay.stop()
      emit("reInit")
    },
  }
}

const articles = getLandingSafeMagazinePreview(6)

describe("SafeMagazineCarousel", () => {
  let fake: ReturnType<typeof createFakeApi>

  beforeEach(() => {
    fake = createFakeApi()
    state.api = fake.api
    state.isMobileViewport = true
    state.allowsMotion = true
  })

  it("記事をすべてスライドとして並べ、記事ページへリンクする", () => {
    render(<SafeMagazineCarousel articles={articles} />)

    expect(screen.getByRole("region", { name: "SAFE MAGAZINE の新着記事" })).toBeInTheDocument()
    expect(screen.getAllByRole("group")).toHaveLength(articles.length)
    expect(screen.getByRole("link", { name: new RegExp(escapeRegExp(articles[0].title)) })).toHaveAttribute(
      "href",
      `/safe-magazine/${articles[0].slug}`,
    )
  })

  it("スマホで視差効果を減らす設定でなければ自動スライドを始め、止めるボタンを出す", () => {
    render(<SafeMagazineCarousel articles={articles} />)

    expect(fake.isPlaying()).toBe(true)
    expect(screen.getByRole("button", { name: "自動スライドを止める" })).toBeInTheDocument()
  })

  it("止めるボタンで止まり、再生ボタンで再開する", () => {
    render(<SafeMagazineCarousel articles={articles} />)

    fireEvent.click(screen.getByRole("button", { name: "自動スライドを止める" }))
    expect(fake.isPlaying()).toBe(false)
    expect(screen.getByRole("button", { name: "自動スライドを再生" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "自動スライドを再生" }))
    expect(fake.isPlaying()).toBe(true)
    expect(screen.getByRole("button", { name: "自動スライドを止める" })).toBeInTheDocument()
  })

  it("視差効果を減らす設定では自動で始めないが、再生ボタンを押せば動く", () => {
    state.allowsMotion = false
    render(<SafeMagazineCarousel articles={articles} />)

    expect(fake.autoplay.play).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "自動スライドを再生" }))
    expect(fake.isPlaying()).toBe(true)
  })

  it("途中で視差効果を減らす設定に変えたら止まる", () => {
    const { rerender } = render(<SafeMagazineCarousel articles={articles} />)
    expect(fake.isPlaying()).toBe(true)

    state.allowsMotion = false
    rerender(<SafeMagazineCarousel articles={articles} />)

    expect(fake.isPlaying()).toBe(false)
  })

  it("PC幅(非表示)では動かさない", () => {
    state.isMobileViewport = false
    render(<SafeMagazineCarousel articles={articles} />)

    expect(fake.autoplay.play).not.toHaveBeenCalled()
  })

  it("回転・リサイズで再初期化されても、止めていなければ再生を続ける", () => {
    render(<SafeMagazineCarousel articles={articles} />)

    act(() => fake.reInit())

    expect(fake.isPlaying()).toBe(true)
    expect(screen.getByRole("button", { name: "自動スライドを止める" })).toBeInTheDocument()
  })

  it("止めたあとの再初期化では再開しない", () => {
    render(<SafeMagazineCarousel articles={articles} />)
    fireEvent.click(screen.getByRole("button", { name: "自動スライドを止める" }))

    act(() => fake.reInit())

    expect(fake.isPlaying()).toBe(false)
  })

  it("スワイプしたら止まり、再初期化でも再開しない", () => {
    render(<SafeMagazineCarousel articles={articles} />)

    act(() => fake.pointerDown())
    act(() => fake.reInit())

    expect(fake.isPlaying()).toBe(false)
    expect(screen.getByRole("button", { name: "自動スライドを再生" })).toBeInTheDocument()
  })

  it("記事にフォーカスが入ったら止まる", () => {
    render(<SafeMagazineCarousel articles={articles} />)

    fireEvent.focus(screen.getAllByRole("link")[0])

    expect(fake.isPlaying()).toBe(false)
  })

  it("矢印キーで送ったら止まる", () => {
    render(<SafeMagazineCarousel articles={articles} />)

    fireEvent.keyDown(screen.getByRole("button", { name: "自動スライドを止める" }), { key: "ArrowRight" })

    expect(fake.isPlaying()).toBe(false)
  })

  it("表示中のスライドに合わせて丸ボタンと読み上げ用の位置表示が変わる", () => {
    render(<SafeMagazineCarousel articles={articles} />)

    expect(screen.getByRole("button", { name: "1件目の記事を表示" })).toHaveAttribute("aria-current", "true")

    act(() => fake.select(2))

    expect(screen.getByRole("button", { name: "3件目の記事を表示" })).toHaveAttribute("aria-current", "true")
    expect(screen.getByRole("button", { name: "1件目の記事を表示" })).not.toHaveAttribute("aria-current")
    expect(screen.getByText(`${articles.length}件中 3件目`, { selector: "p" })).toBeInTheDocument()
  })

  it("読み上げは再生中は黙り、止めたら知らせる", () => {
    render(<SafeMagazineCarousel articles={articles} />)
    const status = screen.getByText(`${articles.length}件中 1件目`, { selector: "p" })
    expect(status).toHaveAttribute("aria-live", "off")

    fireEvent.click(screen.getByRole("button", { name: "自動スライドを止める" }))

    expect(status).toHaveAttribute("aria-live", "polite")
  })

  it("丸ボタンで選んだ記事へ移動し、自動スライドは止める", () => {
    render(<SafeMagazineCarousel articles={articles} />)

    fireEvent.click(screen.getByRole("button", { name: "4件目の記事を表示" }))

    expect(fake.api.scrollTo).toHaveBeenCalledWith(3)
    expect(fake.isPlaying()).toBe(false)
    expect(screen.getByRole("button", { name: "自動スライドを再生" })).toBeInTheDocument()
  })

  it("記事が1件なら自動スライドも操作ボタンも出さない(プラグイン未初期化での例外を避ける)", () => {
    fake = createFakeApi(1)
    state.api = fake.api
    render(<SafeMagazineCarousel articles={articles.slice(0, 1)} />)

    expect(fake.autoplay.play).not.toHaveBeenCalled()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
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

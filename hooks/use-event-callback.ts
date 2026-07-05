"use client"

import { useCallback, useEffect, useLayoutEffect, useRef } from "react"

// useLayoutEffect はサーバーで警告を出すため、SSR 時は useEffect にフォールバックする。
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect

/**
 * 常に最新のクロージャを呼び出す「安定した参照」のコールバックを返す。
 *
 * Mapbox のように初期化時へ一度だけ登録されるイベントハンドラへ渡しても、
 * 登録時点の古い state を掴む（stale closure）ことがなく、呼び出しのたびに
 * 最新の値を読める。返り値の関数はレンダー間で同一参照のため、依存配列にも安全に置ける。
 *
 * React 19 には安定版の useEffectEvent がまだ無いため、ref + layoutEffect による
 * 標準的な useEventCallback パターンで実装している。
 */
export function useEventCallback<Args extends unknown[], Return>(
  fn: (...args: Args) => Return,
): (...args: Args) => Return {
  const ref = useRef(fn)

  useIsomorphicLayoutEffect(() => {
    ref.current = fn
  })

  return useCallback((...args: Args) => ref.current(...args), [])
}

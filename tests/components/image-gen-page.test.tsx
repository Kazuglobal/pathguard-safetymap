import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import ImageGenPage from "@/app/tools/image-gen/page"

describe("ImageGenPage", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("requires a point and sends flood through the gated situation", async () => {
    const fetchMock = vi.fn(async () => Response.json({ images: [] }))
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    render(<ImageGenPage />)

    expect(screen.getByText(
      "教育用の想像図であり、実在地点の浸水想定を示すものではありません。",
    )).toBeInTheDocument()

    await user.selectOptions(screen.getByRole("combobox"), "flood")
    await user.upload(
      screen.getByLabelText("参照画像（必須）"),
      new File(["image"], "street.png", { type: "image/png" }),
    )
    expect(screen.getByRole("button", { name: "画像を生成" })).toBeDisabled()
    await user.type(screen.getByLabelText("経度（必須）"), "140.74")
    await user.type(screen.getByLabelText("緯度（必須）"), "40.82")
    await user.click(screen.getByRole("button", { name: "画像を生成" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const request = fetchMock.mock.calls[0][1]
    const form = request?.body as FormData
    expect(form.get("situation")).toBe("flood")
    expect(form.get("longitude")).toBe("140.74")
    expect(form.get("latitude")).toBe("40.82")
  })

  it("keeps annotation-only hazard visualization available without a point", async () => {
    const fetchMock = vi.fn(async () => Response.json({ images: [] }))
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    render(<ImageGenPage />)

    await user.upload(
      screen.getByLabelText("参照画像（必須）"),
      new File(["image"], "street.png", { type: "image/png" }),
    )
    expect(screen.queryByLabelText("経度（必須）")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "画像を生成" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const form = fetchMock.mock.calls[0][1]?.body as FormData
    expect(form.get("situation")).toBe("viz")
    expect(form.has("longitude")).toBe(false)
    expect(form.has("latitude")).toBe(false)
  })
})

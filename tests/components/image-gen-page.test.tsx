import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import ImageGenPage from "@/app/tools/image-gen/page"

describe("ImageGenPage", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("marks location-neutral presets as imaginary and sends the custom situation", async () => {
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
    await user.click(screen.getByRole("button", { name: "画像を生成" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const request = fetchMock.mock.calls[0][1]
    expect((request?.body as FormData).get("situation")).toBe("custom")
  })
})

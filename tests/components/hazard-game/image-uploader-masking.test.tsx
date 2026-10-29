import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const masking = vi.hoisted(() => ({ requestMaskedPhoto: vi.fn() }))

vi.mock("@/components/media/use-masked-photo-picker", () => ({
  useMaskedPhotoPicker: () => ({ requestMaskedPhoto: masking.requestMaskedPhoto, photoMaskerDialog: null }),
}))
vi.mock("next/image", () => ({ default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} /> }))

import { ImageUploader } from "@/components/hazard-game/image-uploader"

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:masked") })
})

describe("ハザードゲームの写真(UIUX改装 項目57)", () => {
  it("選んだ写真は端末でぼかしてから、ぼかした写真だけを AI の確認に渡す", async () => {
    const original = new File(["raw"], "street.jpg", { type: "image/jpeg" })
    const masked = new File(["masked"], "masked.webp", { type: "image/webp" })
    masking.requestMaskedPhoto.mockResolvedValue({ file: masked, faces: 1, manual: 0 })
    const onImageSelect = vi.fn()
    const { container } = render(<ImageUploader onImageSelect={onImageSelect} />)

    await userEvent.setup().upload(container.querySelector('input[type="file"]') as HTMLInputElement, original)

    await waitFor(() => expect(onImageSelect).toHaveBeenCalledWith(masked))
    expect(masking.requestMaskedPhoto).toHaveBeenCalledWith(original)
    expect(screen.getByAltText("選んだ写真(顔などをぼかしたもの)")).toBeInTheDocument()
  })

  it("ぼかすのをやめたら写真を使わず、大きすぎる写真はブラウザの警告ではなく画面で知らせる", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined)
    masking.requestMaskedPhoto.mockResolvedValue(null)
    const onImageSelect = vi.fn()
    const { container } = render(<ImageUploader onImageSelect={onImageSelect} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const user = userEvent.setup()

    await user.upload(input, new File(["raw"], "street.jpg", { type: "image/jpeg" }))
    await waitFor(() => expect(masking.requestMaskedPhoto).toHaveBeenCalled())
    expect(onImageSelect).not.toHaveBeenCalled()

    const huge = new File(["x"], "huge.jpg", { type: "image/jpeg" })
    Object.defineProperty(huge, "size", { value: 25 * 1024 * 1024 })
    await user.upload(input, huge)
    expect(await screen.findByRole("alert")).toHaveTextContent("20MBまでの写真を選んでください")
    expect(alertSpy).not.toHaveBeenCalled()
  })
})

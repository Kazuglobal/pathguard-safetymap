import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { NotificationList } from "@/components/notifications/notification-list"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe("NotificationList", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows a route update badge and navigates on click", async () => {
    const onNotificationClick = vi.fn(async () => undefined)
    const onClose = vi.fn()

    render(
      <NotificationList
        notifications={[
          {
            id: "notification-1",
            title: "さくらの通学路に新しい危険報告があります",
            content: "見通しの悪い角が報告されました。",
            type: "route_report",
            is_read: false,
            link: "/map?routeId=route-1",
            created_at: new Date().toISOString(),
            user_id: "user-1",
          },
        ]}
        isLoading={false}
        onNotificationClick={onNotificationClick}
        onMarkAllAsRead={vi.fn(async () => undefined)}
        onClose={onClose}
      />
    )

    expect(screen.getByTestId("notification-type-badge")).toHaveTextContent("通学路更新")

    await userEvent.click(screen.getByTestId("notification-item"))

    await waitFor(() => {
      expect(onNotificationClick).toHaveBeenCalledWith("notification-1")
      expect(pushMock).toHaveBeenCalledWith("/map?routeId=route-1")
      expect(onClose).toHaveBeenCalled()
    })
  })

  // ベルから、受け取る通知の切り替え(マイページの設定)へ行ける(UIUX改装 項目37)
  it("links to the notification settings on the my page and closes itself", async () => {
    const onClose = vi.fn()

    render(
      <NotificationList
        notifications={[]}
        isLoading={false}
        onNotificationClick={vi.fn(async () => undefined)}
        onMarkAllAsRead={vi.fn(async () => undefined)}
        onClose={onClose}
      />
    )

    const link = screen.getByRole("menuitem", { name: "通知の設定" })
    expect(link).toHaveAttribute("href", "/mypage#notifications")

    await userEvent.click(link)
    expect(onClose).toHaveBeenCalled()
  })
})

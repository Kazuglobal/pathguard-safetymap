/**
 * マイページの中の場所(UIUX改装 項目37)。ナビのベルの「通知の設定」と、マイページの通知のカードで同じ値を使う。
 * 通知のカードは、未設定ならページのいちばん上に、受け取っているなら「設定」のグループに出す(どちらか一方だけ)。
 */
export const MYPAGE_NOTIFICATIONS_ID = "notifications"

export const MYPAGE_NOTIFICATIONS_PATH = `/mypage#${MYPAGE_NOTIFICATIONS_ID}`

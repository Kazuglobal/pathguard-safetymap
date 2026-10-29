/**
 * お子さまの登録の上限(UIUX改装 項目56)。サーバー(lib/db/repos/children.repo.ts)と画面(入力欄・説明・エラーの文)で同じ値を使う。
 * 画面からも読めるよう、データベースに触れるものから分けて置く
 */
export const CHILD_NICKNAME_MAX_LENGTH = 20
export const MAX_CHILDREN_PER_USER = 10

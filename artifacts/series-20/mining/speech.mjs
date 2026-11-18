// 読み上げ（TTS）用の言い換え。画面の表示名はそのままにして、ナレーションでだけ使う。
// 例: 「30km/hの道」→「時速30キロの道」、「0〜24歳」→「0歳から24歳」

/** 表示名を、TTS が読み違えにくい言い方にする。 */
export function sayOf(label) {
  return label
    .replace(/(\d+)km\/h/g, '時速$1キロ')
    .replace(/(\d+)〜(\d+)歳/g, '$1歳から$2歳')
    .replace(/〜/g, 'から');
}

/** ナレーションに残っていると TTS が読み違えやすい記号。 */
export const UNSPEAKABLE = ['km/h', '〜', '/'];

// 声の下ごしらえ（速さ・音量）→ 無音の検出 → 区切り（marks）→ BGM・効果音と混ぜる。render.mjs から使う（node 専用）。
// 音作りは batch_render.mjs（HTML 版・EP01〜20 の本番）と同じ: 声 atempo 1.08・-14 LUFS、aevalsrc の低音パルス BGM、衝撃音・チック音。
// 違うのは、効果音を「尺の比率」ではなく映像の出来事（柱の着地・第1位の衝撃・理由カード・締め）の時刻に合わせること。
import { execFileSync, spawnSync } from 'node:child_process'
import { IMPACT, T, computeMarks, makeTimeMap, parseSilences, rateText } from './timeline.mjs'

export const SPEED = 1.08
// 声のあとの余白（秒）。締めの文字と出典の行を読める長さにする（最後の文の長さだけだと出典が1秒弱しか出なかった）
export const TAIL = 2.5
const SR = 48000

const ffmpeg = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'ignore', 'inherit'] })

/** 声を 1.08 倍速にして -14 LUFS にそろえる。 */
export function prepareNarration(src, dst) {
  ffmpeg(['-i', src, '-af', `atempo=${SPEED},loudnorm=I=-14:TP=-1.5:LRA=11`, '-ar', String(SR), '-ac', '1', dst])
}

export function probeDuration(file) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim())
}

/** 文と文の間の無音（-35dB 以下が 0.18 秒以上）。 */
export function detectSilences(wav) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'silencedetect=noise=-35dB:d=0.18', '-f', 'null', '-'], { encoding: 'utf8' })
  return parseSilences(r.stderr ?? '')
}

/** 台本と無音から、映像の区切りの時刻（実時間の秒）を決める。 */
export function marksFor(ep, duration, silences) {
  const rates = { ref: rateText(ep.ref.rate), w1: rateText(ep.worst[0].rate), w2: rateText(ep.worst[1].rate), w3: rateText(ep.worst[2].rate) }
  return computeMarks(ep.narration, rates, duration, silences)
}

/** 効果音を鳴らす時刻（実時間の秒）。映像の出来事に合わせる。 */
export function soundEvents(duration, marks) {
  const { fromBase } = makeTimeMap(duration, marks)
  return {
    slam: [0.02],
    tick: [fromBase(T.refStart + T.refGrow), fromBase(T.reasons + 0.2), fromBase(T.reasons + 1.6), fromBase(T.cta + 1.0)],
    mid: [fromBase(T.r3Start + T.grow), fromBase(T.r2Start + T.grow)],
    big: [fromBase(IMPACT)],
  }
}

/** 声＋BGM＋効果音を混ぜて wav にする（長さは duration。声のあとは無音で埋め、BGM はそこまで鳴らす）。 */
export function mixAudio(narr, duration, events, dst) {
  const d = duration.toFixed(3)
  const graph = [
    `[0:a]apad=whole_dur=${d}[narr]`,
    `aevalsrc='0.032*sin(2*PI*49*t)+0.018*sin(2*PI*73.5*t)+0.035*pow(0.5+0.5*sin(2*PI*2*t),12)*sin(2*PI*180*t)':s=${SR}:d=${d},lowpass=f=280[bgm]`,
  ]
  const inputs = ['[narr]', '[bgm]']
  const add = (name, expr, len, t) => {
    const ms = Math.max(0, Math.round(t * 1000))
    graph.push(`aevalsrc='${expr}':s=${SR}:d=${len},adelay=${ms}|${ms}[${name}]`)
    inputs.push(`[${name}]`)
  }
  events.slam.forEach((t, i) => add(`slam${i}`, '0.28*exp(-6*t)*sin(2*PI*(120*exp(-4*t)+36)*t)', 0.6, t))
  events.tick.forEach((t, i) => add(`tick${i}`, '0.12*exp(-42*t)*sin(2*PI*1560*t)', 0.1, t))
  events.mid.forEach((t, i) => add(`mid${i}`, '0.22*exp(-6*t)*sin(2*PI*(140*exp(-4*t)+40)*t)', 0.6, t))
  events.big.forEach((t, i) => add(`big${i}`, '0.40*exp(-4.5*t)*sin(2*PI*(110*exp(-3.5*t)+34)*t)', 0.85, t))
  graph.push(`${inputs.join('')}amix=inputs=${inputs.length}:normalize=0:duration=first,alimiter=limit=0.95[aout]`)
  ffmpeg(['-i', narr, '-filter_complex', graph.join(';'), '-map', '[aout]', '-ar', String(SR), '-ac', '2', dst])
}

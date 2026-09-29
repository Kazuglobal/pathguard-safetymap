import type { PrintDocument, PrintItem } from './print-document'
import { splitFurigana } from '@/lib/hunter/furigana'

export const PRINT_CSS = `
.route-sheet{box-sizing:border-box;width:210mm;height:297mm;padding:12mm;background:#fff;color:#182b26;font-family:Arial,"Noto Sans JP",sans-serif;font-size:14pt;line-height:1.6;display:flex;flex-direction:column;overflow:hidden;word-break:normal;overflow-wrap:anywhere;text-align:left}
.route-sheet *{box-sizing:border-box}
.route-sheet h1,.route-sheet h2,.route-sheet h3,.route-sheet p{margin:0}
.route-sheet h1{font-size:22pt;line-height:1.4;font-weight:800}
.route-sheet h2{font-size:16pt;line-height:1.5;font-weight:700}
.route-sheet h3{font-size:15pt;line-height:1.5;font-weight:700}
.route-sheet .sheet-header{border-bottom:0.7mm solid #235c4e;padding-bottom:4mm;margin-bottom:5mm;flex-shrink:0}
.route-sheet .sheet-kicker{font-size:11pt;font-weight:700;letter-spacing:0.05em;margin-bottom:2mm}
.route-sheet .sheet-course{font-size:13pt;margin-top:2mm}
.route-sheet .sheet-body{flex:1;min-height:0;overflow:hidden}
.route-sheet .sheet-block{margin-bottom:4mm;break-inside:avoid}
.route-sheet .sheet-card{border:0.35mm solid #4e655b;padding:4mm;margin-bottom:4mm;border-radius:2mm}
.route-sheet .sheet-number{display:inline-flex;align-items:center;justify-content:center;min-width:9mm;height:9mm;border:0.5mm solid #235c4e;border-radius:50%;font-size:15pt;margin-right:3mm;vertical-align:middle;font-weight:700}
.route-sheet .sheet-caption{font-size:12pt;line-height:1.6;margin:2mm 0}
.route-sheet .sheet-photo{width:52mm;height:34mm;object-fit:contain;background:#f3f5f1;float:left;margin:2mm 4mm 2mm 0;border:0.2mm solid #8a998f}
.route-sheet .sheet-photo-missing{float:left;width:52mm;min-height:24mm;padding:3mm;margin:2mm 4mm 2mm 0;border:0.3mm dashed #627268;font-size:12pt}
.route-sheet .sheet-map{width:100%;height:85mm;object-fit:contain;border:0.3mm solid #627268}
.route-sheet .sheet-label{font-size:12pt;font-weight:700;display:block;margin-top:2mm}
.route-sheet .sheet-checks{clear:both;display:flex;flex-wrap:wrap;gap:5mm;padding-top:3mm;font-size:12pt}
.route-sheet .sheet-box{display:inline-block;width:6mm;height:6mm;border:0.4mm solid #263b31;vertical-align:middle;margin-right:2mm}
.route-sheet .sheet-writing{height:9mm;border-bottom:0.3mm solid #52665a}
.route-sheet .sheet-footer{display:flex;justify-content:space-between;border-top:0.3mm solid #64776e;padding-top:2mm;margin-top:4mm;font-size:10pt;flex-shrink:0}
.route-sheet .sheet-clear{clear:both}
.route-sheet .sheet-ruby{display:inline-flex;flex-direction:column;align-items:center;vertical-align:bottom;line-height:1.25;margin-top:0.8mm}
.route-sheet .sheet-reading{font-size:7pt;line-height:1.2;white-space:nowrap;font-weight:400}
@media print{@page{size:A4 portrait;margin:0}html,body{margin:0!important;padding:0!important;background:white!important}.route-sheet{break-after:page;box-shadow:none!important;margin:0!important}.route-sheet:last-child{break-after:auto}}
`

export interface PreparedPrint { source: PrintDocument; pages: HTMLDivElement[]; warnings: string[] }
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node
}
function numberedHeading(item: PrintItem, continued = false) {
  const heading = element('h3')
  heading.append(element('span', String(item.number), 'sheet-number'), document.createTextNode(`${item.title}${continued ? '（つづき）' : ''}`))
  return heading
}
function checks() {
  const row = element('div', '', 'sheet-checks')
  for (const text of ['話せた', '一緒にたしかめた']) {
    const label = element('span'); label.append(element('span', '', 'sheet-box'), document.createTextNode(text)); row.append(label)
  }
  return row
}
function paragraphs(text: string) {
  // Small indivisible chunks allow exceptionally long text to continue at a
  // paragraph boundary without reducing its physical font size or losing text.
  const chars = Array.from(text)
  const nodes: HTMLElement[] = []
  for (let i = 0; i < chars.length; i += 100) nodes.push(element('p', chars.slice(i, i + 100).join('')))
  return nodes
}
async function loadImage(url: string, className: string, alt: string, signal?: AbortSignal): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    if (signal?.aborted) { resolve(null); return }
    const img = element('img', '', className); img.alt = alt
    img.crossOrigin = 'anonymous'
    const timer = setTimeout(() => finish(null), 12_000)
    let done = false
    const cancel = () => { finish(null); img.src = '' }
    const finish = (value: HTMLImageElement | null) => { if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel); img.onload = null; img.onerror = null; resolve(value) }
    img.onload = () => finish(img.naturalWidth ? img : null)
    img.onerror = () => finish(null)
    signal?.addEventListener('abort', cancel, { once: true })
    img.src = url
  })
}
export function mountPrintPages(pages: HTMLDivElement[]) {
  const host = element('div'); host.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;pointer-events:none;'
  host.append(element('style', PRINT_CSS), ...pages)
  document.body.append(host)
  return host
}

export async function preparePrintPages(source: PrintDocument, signal?: AbortSignal): Promise<PreparedPrint> {
  await document.fonts?.ready
  signal?.throwIfAborted()
  const warnings: string[] = []
  const photos = new Map<string, HTMLImageElement>()
  // Limit concurrent decoding and keep failed images out of both preview and PDF.
  for (const item of source.items) {
    if (!item.photoUrl) continue
    const photo = await loadImage(item.photoUrl, 'sheet-photo', `${item.number}. ${item.title}`, signal)
    signal?.throwIfAborted()
    if (photo) photos.set(item.id, photo)
    else warnings.push(`${item.number}. ${item.title}：写真を読み込めなかったため、写真なしで作成します。`)
  }
  const map = source.mapUrl ? await loadImage(source.mapUrl, 'sheet-map', '通学路と確認する場所の地図', signal) : null
  signal?.throwIfAborted()
  if (source.mapUrl && !map) warnings.push('地図を読み込めなかったため、地図なしで作成します。')
  const pages: HTMLDivElement[] = []
  const host = mountPrintPages([])
  function readable(node: HTMLElement) {
    if (!source.furigana) return
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    const texts: Text[] = []
    while (walker.nextNode()) {
      const current = walker.currentNode as Text
      if (!current.parentElement?.closest('.sheet-ruby') && /[一-龯]/.test(current.data)) texts.push(current)
    }
    for (const text of texts) {
      const fragment = document.createDocumentFragment()
      for (const token of splitFurigana(text.data)) {
        if (!token.r) { fragment.append(document.createTextNode(token.t)); continue }
        const ruby = element('span', '', 'sheet-ruby'), reading = element('span', token.r, 'sheet-reading')
        reading.setAttribute('aria-hidden', 'true'); ruby.append(reading, element('span', token.t)); fragment.append(ruby)
      }
      text.replaceWith(fragment)
    }
  }
  let body: HTMLDivElement
  function newPage(detail: boolean) {
    const page = element('div', '', 'route-sheet')
    const header = element('header', '', 'sheet-header')
    header.append(element('p', source.purpose === 'school' ? '学校でつかう チェックシート' : '親子でつかう チェックシート', 'sheet-kicker'))
    header.append(element('h1', detail ? (photos.size ? '写真で話して、たしかめよう' : '話して、たしかめよう') : '今日の道を たしかめよう'))
    header.append(element('p', source.title, 'sheet-course'))
    readable(header)
    body = element('div', '', 'sheet-body')
    const footer = element('footer', '', 'sheet-footer')
    const date = new Date(source.generatedAt)
    footer.append(element('span', `作成日 ${Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ja-JP')}`), element('span', '', 'sheet-page-number'))
    page.append(header, body, footer); host.append(page); pages.push(page)
  }
  function fits() { return body.clientHeight > 0 && body.scrollHeight <= body.clientHeight + 1 }
  function place(node: HTMLElement, detail: boolean) {
    readable(node)
    body.append(node)
    if (fits()) return
    node.remove()
    if (body.children.length) newPage(detail)
    body.append(node)
    if (!fits()) throw new Error('内容が用紙の高さを超えました。地点名を短くするか、説明を分けてください。')
  }
  try {
    newPage(false)
    if (!body!.clientHeight) throw new Error('印刷プレビューを表示できませんでした。画面を開き直してください。')
    place(element('p', 'たしかめた日：　　 月　　 日　　天気：　　　　　　', 'sheet-block sheet-caption'), false)
    if (map) { const block = element('div', '', 'sheet-block'); block.append(map, element('p', source.mapNote ?? '', 'sheet-caption')); place(block, false) }
    for (const item of source.items) {
      const block = element('div', '', 'sheet-card'); block.append(numberedHeading(item))
      if (source.purpose === 'school') block.append(element('p', item.observation, 'sheet-caption'))
      block.append(element('p', item.action), checks()); place(block, false)
    }
    const writing = element('div', '', 'sheet-block'); writing.append(element('h2', source.purpose === 'school' ? '気づいたこと・話し合ったこと' : '親子で気づいたこと'), element('div', '', 'sheet-writing'), element('div', '', 'sheet-writing'))
    place(writing, false)
    if (source.purpose === 'family' && source.items.length) {
      newPage(true)
      for (const item of source.items) {
        const intro = element('div'); intro.append(numberedHeading(item))
        const photo = photos.get(item.id)
        if (photo) intro.append(photo)
        intro.append(element('span', 'たしかめること', 'sheet-label'))
        const chunks = [...paragraphs(item.observation), element('div', '', 'sheet-clear'), element('span', '親子でたしかめる行動', 'sheet-label'), ...paragraphs(item.action), checks()]
        const card = element('div', '', 'sheet-card'); card.append(intro, ...chunks)
        readable(card)
        body!.append(card)
        if (fits()) continue
        card.remove()
        // Try the whole card on a fresh page before splitting long content.
        if (body!.children.length) newPage(true)
        body!.append(card)
        if (fits()) continue
        card.remove()
        let part = element('div', '', 'sheet-card'); part.append(intro); body!.append(part)
        if (!fits()) throw new Error('写真の見出しが長すぎます。地点名を短くしてください。')
        for (const chunk of chunks) {
          part.append(chunk)
          if (fits()) continue
          chunk.remove(); newPage(true)
          part = element('div', '', 'sheet-card'); part.append(numberedHeading(item, true), chunk); readable(part); body!.append(part)
          if (!fits()) throw new Error('説明を用紙に配置できませんでした。内容を確認してください。')
        }
      }
    }
    pages.forEach((page, i) => { page.querySelector('.sheet-page-number')!.textContent = `${i + 1} / ${pages.length}` })
    return { source, pages: pages.map(page => page.cloneNode(true) as HTMLDivElement), warnings }
  } finally { host.remove() }
}

import { mountPrintPages, PRINT_CSS, type PreparedPrint } from './print-pages'

export async function savePrintPdf(prepared: PreparedPrint) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const copies = prepared.pages.map(page => page.cloneNode(true) as HTMLDivElement)
  const host = mountPrintPages(copies)
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  try {
    for (let index = 0; index < copies.length; index++) {
      const canvas = await html2canvas(copies[index], { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
      if (index > 0) pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297)
      canvas.width = 0; canvas.height = 0
    }
    downloadBlob(pdf.output('blob'), `${prepared.source.title}_チェックシート.pdf`)
  } finally { host.remove() }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = filename.replace(/[<>:"/\\|?*]/g, '_')
  document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export async function savePrintImage(prepared: PreparedPrint, index: number, format: 'png' | 'jpeg') {
  if (!prepared.pages[index]) throw new Error('保存するページを確認してください。')
  const { default: html2canvas } = await import('html2canvas')
  const copy = prepared.pages[index].cloneNode(true) as HTMLDivElement
  const host = mountPrintPages([copy])
  try {
    const canvas = await html2canvas(copy, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('画像を保存できませんでした。')), `image/${format}`, 0.92))
    downloadBlob(blob, `${prepared.source.title}_${index + 1}ページ.${format}`)
    canvas.width = 0; canvas.height = 0
  } finally { host.remove() }
}

export async function printPreparedPages(prepared: PreparedPrint) {
  const frame = document.createElement('iframe')
  frame.title = 'チェックシートの印刷'; frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;'
  document.body.append(frame)
  const doc = frame.contentDocument; const win = frame.contentWindow
  if (!doc || !win) { frame.remove(); throw new Error('印刷画面を開けませんでした。PDFを保存して印刷してください。') }
  const style = doc.createElement('style'); style.textContent = PRINT_CSS; doc.head.append(style)
  doc.title = '通学路チェックシート'
  for (const page of prepared.pages) doc.body.append(doc.importNode(page, true))
  await doc.fonts?.ready
  await Promise.all(Array.from(doc.images).map(img => img.decode().catch(() => undefined)))
  win.addEventListener('afterprint', () => frame.remove(), { once: true })
  // Some mobile browsers do not dispatch afterprint. Keep content available while
  // their print dialog is open, then reclaim the detached printing surface.
  setTimeout(() => frame.remove(), 300_000)
  win.focus(); win.print()
}

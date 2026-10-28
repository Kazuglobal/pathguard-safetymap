'use client'
import { useEffect, useState } from 'react'
import { routeRequest } from './course-library'
const btn = 'min-h-11 rounded-xl border px-4 py-2 font-bold disabled:opacity-40'
const scenarios: Record<string, string> = { normal: 'いつもの道', rain: '雨の日', evening: '夕方', earthquake: '地震' }
const categories: Record<string, string> = { traffic: '交通', fall: '転落', water: '水路', construction: '工事', darkness: '暗い道', 'personal-safety': '防犯', rain: '大雨', earthquake: '地震' }
export function SchoolPanel({ onJoined }: { onJoined?: () => void }) {
  const [data, setData] = useState<{ membership: { schoolName: string; role: string } | null; canCreateSchool: boolean } | null>(null)
  const [code, setCode] = useState(''); const [name, setName] = useState(''); const [year, setYear] = useState(1)
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [records, setRecords] = useState<Array<{ userId: string; courseTitle: string; sceneId: string; scenario: string; cleared: boolean; attempts: number; missedKinds: string[] }>>([])
  const [recordsLoaded, setRecordsLoaded] = useState(false)
  useEffect(() => { routeRequest('/api/hunter/routes/school').then(setData).catch(err => setMessage(err.message)) }, [])
  async function action(body: unknown) {
    setBusy(true); setMessage('')
    try { const result = await routeRequest('/api/hunter/routes/school', body); setData(await routeRequest('/api/hunter/routes/school')); if (result.code) setMessage(`招待コード：${result.code}（7日間有効）`); else { setMessage('学校情報を保存しました。'); onJoined?.() } }
    catch (err) { setMessage((err as Error).message) } finally { setBusy(false) }
  }
  async function loadRecords() {
    setBusy(true); setMessage('')
    try { setRecords((await routeRequest('/api/hunter/routes/school/records')).records); setRecordsLoaded(true) }
    catch (err) { setMessage((err as Error).message) } finally { setBusy(false) }
  }
  return <details className="mb-6 rounded-2xl bg-white p-5"><summary className="cursor-pointer font-bold">学校への参加・先生の学習記録</summary>
    {data?.membership ? <div className="mt-4"><p>{data.membership.schoolName} · {data.membership.role === 'teacher' ? '先生' : '児童・生徒'}</p>{data.membership.role === 'teacher' && <div className="mt-3 flex flex-wrap gap-3"><button className={btn} disabled={busy} onClick={() => action({ action: 'create-invite' })}>児童用の招待コードを作成</button><button className={btn} disabled={busy} onClick={loadRecords}>学習記録を見る</button></div>}</div> : <div className="mt-4 space-y-3"><p className="text-sm text-slate-600">先生から受け取った招待コードで参加します。参加前も自分だけのコースを作成できます。</p><label className="block">招待コード<input className="ml-2 min-h-11 rounded-lg border px-3" value={code} onChange={e => setCode(e.target.value)} /></label><label className="block">学年<select className="ml-2 min-h-11 rounded-lg border px-3" value={year} onChange={e => setYear(Number(e.target.value))}>{Array.from({ length: 9 }, (_, i) => <option value={i + 1} key={i}>{i < 6 ? `小学${i + 1}年` : `中学${i - 5}年`}</option>)}</select></label><button className={btn} disabled={busy || !code.trim()} onClick={() => action({ action: 'join', code, schoolYear: year })}>学校に参加する</button>{data?.canCreateSchool && <div className="border-t pt-3"><label>学校名<input className="ml-2 min-h-11 rounded-lg border px-3" value={name} onChange={e => setName(e.target.value)} /></label><button className={btn} disabled={busy || !name.trim()} onClick={() => action({ action: 'create-school', name })}>管理者として学校を登録</button></div>}</div>}
    {message && <p role="status" className="mt-3 break-all rounded-lg bg-slate-100 p-3 text-sm">{message}</p>}
    {recordsLoaded && records.length === 0 && <p role="status" className="mt-4 text-sm text-slate-600">まだ学習記録はありません。</p>}
    {!!records.length && <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>児童ID</th><th>コース</th><th>場面</th><th>学習</th><th>復習したい危険</th></tr></thead><tbody>{records.map((r, i) => <tr key={i} className="border-t"><td className="p-2">{r.userId.slice(0, 8)}</td><td>{r.courseTitle}</td><td>{scenarios[r.scenario] ?? r.scenario}</td><td>{r.cleared ? 'クリア' : '復習中'}・{r.attempts}回</td><td>{r.missedKinds?.map(kind => categories[kind] ?? kind).join('・') || 'なし'}</td></tr>)}</tbody></table></div>}
  </details>
}

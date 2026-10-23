import 'server-only'
import type { Actor } from '@/lib/db/authz'
import { getScenarioCurriculum, HAZARD_CURRICULUM } from './curriculum'
import { createCourse, getCourse, getRouteDatabase, readSchoolMembership, RepositoryError, requireRouteUser, updateCourseOwned, type CourseRecord } from './repository'
import { canEditCourse } from './service'
import { photoQuizConfigSchema, quizAnswerSchema, quizScenarios, type PhotoQuizItem, type PhotoQuizScenario, type PhotoQuizView } from './photo-quiz-schema'
import { applyPhotoQuizAnswer, buildPhotoQuizState, photoQuizView, QuizInputError, type PhotoQuizState } from './photo-quiz-engine'
import type { StoredScene } from './types'
import { routePhotoUrl } from './notes'
import type { PhotoQuizOutline } from './photo-quiz-schema'

type QuizRow = { id: string; user_id: string; course_id: string; revision: number; scenario: PhotoQuizScenario; version: number; state_json: string }
export function configuredQuizItems(course: CourseRecord): PhotoQuizItem[] {
  return photoQuizConfigSchema.parse({ revision: course.revision, items: course.data.quizItems ?? [] }).items
}
export async function getQuizConfig(actor: Actor, id: string) {
  const course = await getCourse(actor, id)
  if (!await canEditCourse(actor, course)) throw new RepositoryError(403, 'forbidden', '編集できません。')
  return { revision: course.revision, items: configuredQuizItems(course), templates: HAZARD_CURRICULUM.map(template => ({ id: template.id, title: template.title, category: template.category, focus: template.focus, hypothetical: template.situation, outcome: template.outcome, scenarios: quizScenarios.filter(scenario => getScenarioCurriculum(scenario, course.data.schoolYear).some(value => value.id === template.id)) })) }
}
export async function saveQuizConfig(actor: Actor, id: string, raw: unknown) {
  const input = photoQuizConfigSchema.parse(raw)
  const course = await getCourse(actor, id)
  if (!await canEditCourse(actor, course)) throw new RepositoryError(403, 'forbidden', '編集できません。')
  if (course.data.learningMode !== 'photo-quiz-v1') throw new RepositoryError(409, 'legacy', '写真クイズ用の下書きを作成してから編集してください。')
  if (input.revision !== course.revision) throw new RepositoryError(409, 'revision', '別の編集が保存されています。読み直してください。')
  const scenes = course.data.scenes as StoredScene[]
  for (const item of input.items) {
    const scene = scenes.find(value => value.id === item.sceneId)
    if (!scene?.photoKeys[item.photoIndex] || !HAZARD_CURRICULUM.some(template => template.id === item.templateId)) throw new RepositoryError(400, 'quiz_item', '写真と問題の種類を確認してください。')
    if (!getScenarioCurriculum(item.scenario, course.data.schoolYear).some(template => template.id === item.templateId)) throw new RepositoryError(400, 'quiz_scenario', '学ぶ危険に合う場面を選んでください。')
  }
  if (course.data.learningMode === 'photo-quiz-v1' && JSON.stringify(course.data.quizItems) === JSON.stringify(input.items)) return course
  return updateCourseOwned(actor, id, course.revision, { ...course.data, learningMode: 'photo-quiz-v1', quizItems: input.items, reviewed: false,
    status: input.items.some(item => item.scenario === 'normal') ? 'ready' : 'draft' })
}
export async function copyPhotoQuizCourse(actor: Actor, id: string) {
  const course = await getCourse(actor, id)
  if (!await canEditCourse(actor, course)) throw new RepositoryError(403, 'forbidden', '編集できません。')
  const scenes = (course.data.scenes as StoredScene[]).map(scene => ({ id: scene.id, name: scene.name, photoKeys: scene.photoKeys, notes: scene.notes ?? [], status: 'queued' }))
  return createCourse(actor, { title: `${course.data.title.slice(0, 55)}（写真クイズ）`, schoolYear: course.data.schoolYear, status: 'draft', reviewed: false, learningMode: 'photo-quiz-v1', scenes, quizItems: [] })
}
function view(row: QuizRow, state = JSON.parse(row.state_json) as PhotoQuizState): PhotoQuizView {
  return photoQuizView(state, { id: row.id, version: row.version, courseId: row.course_id, revision: row.revision, scenario: row.scenario })
}
async function readSession(actor: Actor, courseId: string, sessionId: string) {
  const user = requireRouteUser(actor)
  const course = await getCourse(actor, courseId)
  const row = await getRouteDatabase().prepare('SELECT * FROM hunter_photo_quiz_sessions WHERE id = ? AND user_id = ? AND course_id = ?').bind(sessionId, user.id, courseId).first<QuizRow>()
  if (!row) throw new RepositoryError(404, 'session', '学習記録が見つかりません。')
  if (row.revision !== course.revision) throw new RepositoryError(409, 'revision', 'コースが更新されました。新しい問題から始めてください。')
  return row
}
export async function getQuizSession(actor: Actor, courseId: string, sessionId: string) { return view(await readSession(actor, courseId, sessionId)) }

/** Only the signed-in learner's current-revision progress, without answers or hazard regions. */
export async function getQuizOutline(actor: Actor, courseId: string): Promise<PhotoQuizOutline> {
  const user = requireRouteUser(actor), course = await getCourse(actor, courseId), db = getRouteDatabase()
  const prior = await db.prepare(`SELECT DISTINCT json_extract(lesson.value, '$.item.id') AS item_id
    FROM hunter_photo_quiz_sessions s, json_each(s.state_json, '$.lessons') lesson
    WHERE s.user_id = ? AND s.course_id = ? AND s.revision = ?
      AND json_extract(lesson.value, '$.found') = 1 AND json_extract(lesson.value, '$.reasonCorrect') = 1
      AND json_extract(lesson.value, '$.actionCorrect') = 1`).bind(user.id, courseId, course.revision).all<{ item_id: string }>()
  const learned = new Set(prior.results.map(item => item.item_id))
  const latest = await db.prepare(`SELECT * FROM hunter_photo_quiz_sessions WHERE user_id = ? AND course_id = ? AND revision = ?
    AND json_extract(state_json, '$.stage') = 'complete' ORDER BY updated_at DESC LIMIT 1`).bind(user.id, courseId, course.revision).first<QuizRow>()
  return { items: configuredQuizItems(course).map(item => ({ id: item.id, sceneId: item.sceneId,
    title: (course.data.scenes as StoredScene[]).find(scene => scene.id === item.sceneId)?.name ?? 'たしかめる場所',
    photoUrl: routePhotoUrl(courseId, item.sceneId, item.photoIndex), scenario: item.scenario, cleared: learned.has(item.id) })),
    latestCompleted: latest ? view(latest) : null }
}

export async function listPhotoQuizTeacherRecords(actor: Actor) {
  const db = getRouteDatabase(), membership = await readSchoolMembership(db, actor)
  if (membership?.role !== 'teacher') throw new RepositoryError(403, 'teacher_required', '学校の先生のみ学習記録を確認できます。')
  const result = await db.prepare(`SELECT s.user_id AS userId, json_extract(c.data_json, '$.title') AS courseTitle,
    json_extract(lesson.value, '$.item.sceneId') AS sceneId, s.scenario,
    MAX(CASE WHEN json_extract(lesson.value, '$.found') = 1 AND json_extract(lesson.value, '$.reasonCorrect') = 1
      AND json_extract(lesson.value, '$.actionCorrect') = 1 THEN 1 ELSE 0 END) AS cleared,
    COUNT(*) AS attempts, MAX(json_extract(lesson.value, '$.mistakes')) AS mistakes,
    json_extract(lesson.value, '$.item.templateId') AS templateId
    FROM hunter_photo_quiz_sessions s JOIN hunter_route_courses c ON c.id = s.course_id AND c.revision = s.revision
    JOIN hunter_route_memberships m ON m.user_id = s.user_id AND m.school_id = c.school_id,
    json_each(s.state_json, '$.lessons') lesson
    WHERE c.school_id = ? AND m.role = 'student'
    GROUP BY s.user_id, s.course_id, s.scenario, json_extract(lesson.value, '$.item.id')
    ORDER BY MAX(s.updated_at) DESC LIMIT 1000`).bind(membership.schoolId).all<{
      userId: string; courseTitle: string; sceneId: string; scenario: PhotoQuizScenario; cleared: number; attempts: number; mistakes: number; templateId: string
    }>()
  return result.results.map(({ mistakes, templateId, ...record }) => ({ ...record, courseTitle: `${record.courseTitle}（写真クイズ）`, cleared: record.cleared === 1,
    missedKinds: mistakes > 0 ? HAZARD_CURRICULUM.filter(template => template.id === templateId).map(template => template.category) : [] }))
}

export async function startQuizSession(actor: Actor, courseId: string, scenario: PhotoQuizScenario) {
  const user = requireRouteUser(actor), db = getRouteDatabase()
  const course = await getCourse(actor, courseId)
  if (course.data.learningMode !== 'photo-quiz-v1' || course.data.status !== 'ready') throw new RepositoryError(409, 'not_ready', '写真の問題を作成してから始めてください。')
  const items = configuredQuizItems(course)
  // Return only learned IDs, never an ever-growing list of complete session snapshots.
  const prior = await db.prepare(`SELECT DISTINCT json_extract(lesson.value, '$.item.id') AS item_id, s.scenario
    FROM hunter_photo_quiz_sessions s, json_each(s.state_json, '$.lessons') lesson
    WHERE s.user_id = ? AND s.course_id = ? AND s.revision = ?
      AND json_extract(lesson.value, '$.found') = 1 AND json_extract(lesson.value, '$.reasonCorrect') = 1
      AND json_extract(lesson.value, '$.actionCorrect') = 1`).bind(user.id, courseId, course.revision).all<{ item_id: string; scenario: PhotoQuizScenario }>()
  const learned = new Set<string>()
  const normalLearned = new Set<string>()
  for (const saved of prior.results) {
    if (saved.scenario === scenario) learned.add(saved.item_id)
    if (saved.scenario === 'normal') normalLearned.add(saved.item_id)
  }
  if (scenario !== 'normal' && items.some(item => item.scenario === 'normal' && !normalLearned.has(item.id))) throw new RepositoryError(409, 'locked', 'いつもの道の全地点をクリアすると開きます。')
  const candidates = items.filter(item => item.scenario === scenario)
  if (!candidates.length) throw new RepositoryError(409, 'no_questions', 'この場面の問題はまだありません。')
  const activeQuery = 'SELECT * FROM hunter_photo_quiz_sessions WHERE user_id = ? AND course_id = ? AND revision = ? AND scenario = ? AND json_extract(state_json, \'$.stage\') <> \'complete\' LIMIT 1'
  const active = await db.prepare(activeQuery).bind(user.id, courseId, course.revision, scenario).first<QuizRow>()
  if (active) return view(active)
  const pending = candidates.filter(item => !learned.has(item.id))
  const membership = await readSchoolMembership(db, actor)
  const state = buildPhotoQuizState(course.data.title, membership?.schoolYear ?? course.data.schoolYear, (pending.length ? pending : candidates).slice(0, 3))
  const now = new Date().toISOString()
  await db.prepare(`INSERT OR IGNORE INTO hunter_photo_quiz_sessions(id,user_id,course_id,revision,scenario,version,state_json,created_at,updated_at)
    SELECT ?,?,?,?,?,0,?,?,? WHERE EXISTS(SELECT 1 FROM hunter_route_courses WHERE id = ? AND revision = ?)`)
    .bind(crypto.randomUUID(), user.id, courseId, course.revision, scenario, JSON.stringify(state), now, now, courseId, course.revision).run()
  const created = await db.prepare(activeQuery).bind(user.id, courseId, course.revision, scenario).first<QuizRow>()
  if (!created) throw new RepositoryError(409, 'revision', 'コースを読み直してください。')
  return view(created)
}

export async function answerQuizSession(actor: Actor, courseId: string, sessionId: string, raw: unknown) {
  const input = quizAnswerSchema.parse(raw), db = getRouteDatabase()
  const row = await readSession(actor, courseId, sessionId)
  const replay = await db.prepare('SELECT response_json FROM hunter_photo_quiz_events WHERE session_id = ? AND request_id = ?').bind(sessionId, input.requestId).first<{ response_json: string }>()
  if (replay) return JSON.parse(replay.response_json) as PhotoQuizView
  if (row.version !== input.version) throw new RepositoryError(409, 'session_version', '学習記録が更新されています。続きを読み直してください。')
  const recent = await db.prepare('SELECT COUNT(*) AS count FROM hunter_photo_quiz_events WHERE session_id = ? AND created_at > ?')
    .bind(sessionId, new Date(Date.now() - 60_000).toISOString()).first<{ count: number }>()
  if ((recent?.count ?? 0) >= 60) throw new RepositoryError(429, 'attempt_limit', '少し待ってから、同じ回答をもう一度送ってください。')
  let state: PhotoQuizState
  try { state = applyPhotoQuizAnswer(JSON.parse(row.state_json), input) }
  catch (error) { if (error instanceof QuizInputError) throw new RepositoryError(400, 'answer', error.message); throw error }
  const result = view({ ...row, version: row.version + 1 }, state), now = new Date().toISOString()
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO hunter_photo_quiz_events(session_id,request_id,response_json,created_at)
      SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM hunter_photo_quiz_sessions s JOIN hunter_route_courses c ON c.id=s.course_id
        WHERE s.id=? AND s.user_id=? AND s.version=? AND c.revision=s.revision
          AND (c.owner_id = ? OR EXISTS(SELECT 1 FROM hunter_route_memberships m
            WHERE m.user_id = ? AND m.school_id = c.school_id AND (c.published = 1 OR m.role = 'teacher'))))`)
      .bind(sessionId, input.requestId, JSON.stringify(result), now, sessionId, row.user_id, row.version, row.user_id, row.user_id),
    db.prepare(`UPDATE hunter_photo_quiz_sessions SET state_json=?, version=version+1, updated_at=? WHERE id=? AND version=?
      AND EXISTS(SELECT 1 FROM hunter_photo_quiz_events WHERE session_id=? AND request_id=?)`)
      .bind(JSON.stringify(state), now, sessionId, row.version, sessionId, input.requestId),
  ])
  const saved = await db.prepare('SELECT response_json FROM hunter_photo_quiz_events WHERE session_id = ? AND request_id = ?').bind(sessionId, input.requestId).first<{ response_json: string }>()
  if (!saved) throw new RepositoryError(409, 'session_version', '別の回答が保存されました。続きを読み直してください。')
  return JSON.parse(saved.response_json) as PhotoQuizView
}

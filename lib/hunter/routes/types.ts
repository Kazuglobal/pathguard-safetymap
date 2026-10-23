import type { SceneNote } from './notes'

export type GenerationModel = 'marble-1.0-draft' | 'marble-1.1'
export type SceneStatus = 'queued' | 'submitting' | 'running' | 'ready' | 'failed' | 'unknown'
export interface StoredScene {
  id: string
  name: string
  photoKeys: string[]
  status: SceneStatus
  operationId?: string
  splatKey?: string
  scale?: number
  groundOffset?: number
  error?: string
  notes?: SceneNote[]
}
export interface CourseView {
  learningMode?: 'photo-quiz-v1' | 'legacy-3d'
  id: string
  revision: number
  title: string
  schoolYear: number
  learnerSchoolYear: number
  status: string
  published: boolean
  reviewed: boolean
  ownedByMe?: boolean
  canEdit: boolean
  model: GenerationModel
  scenes: Array<{ id: string; name: string; status: SceneStatus; photoCount: number; notes: SceneNote[]; splatUrl?: string; scale?: number; groundOffset?: number; error?: string }>
}

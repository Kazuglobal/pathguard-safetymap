import { z } from 'zod'

export const quizScenarios = ['normal', 'rain', 'evening', 'earthquake'] as const
export const photoRegionSchema = z.object({
  x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1),
  width: z.number().finite().min(0.02).max(1), height: z.number().finite().min(0.02).max(1),
}).strict().refine(region => region.x + region.width <= 1.000001 && region.y + region.height <= 1.000001, '写真の中に囲んでください。')
export const photoQuizItemSchema = z.object({
  id: z.string().uuid(), sceneId: z.string().uuid(), photoIndex: z.number().int().min(0).max(7),
  title: z.string().trim().min(1).max(60), templateId: z.string().min(1).max(60),
  scenario: z.enum(quizScenarios),
  observed: z.string().trim().min(1).max(240), hypothetical: z.string().trim().min(1).max(240),
  region: photoRegionSchema,
}).strict()
export const photoQuizConfigSchema = z.object({
  revision: z.number().int().positive(), items: z.array(photoQuizItemSchema).max(96),
}).strict().refine(input => new Set(input.items.map(item => item.id)).size === input.items.length, '同じ問題を重複して保存できません。')
export type PhotoQuizItem = z.infer<typeof photoQuizItemSchema>
export type PhotoRegion = z.infer<typeof photoRegionSchema>
export type PhotoQuizScenario = typeof quizScenarios[number]
export interface PhotoQuizOutline {
  items: Array<{ id: string; sceneId: string; title: string; photoUrl: string; scenario: PhotoQuizScenario; cleared: boolean }>;
  latestCompleted: PhotoQuizView | null;
}
export type PhotoQuizStage = 'find' | 'reason' | 'action' | 'feedback' | 'complete'
export interface PhotoQuizChoice { id: string; text: string }
export interface PhotoQuizView {
  id: string; version: number; courseId: string; revision: number; title: string; schoolYear: number;
  scenario: PhotoQuizScenario; stage: PhotoQuizStage; index: number; total: number;
  item?: { id: string; title: string; photoUrl: string; observed?: string; hypothetical: string; region?: PhotoRegion };
  question?: { prompt: string; choices: PhotoQuizChoice[] };
  feedback?: { correct: boolean; text: string };
  learned: Array<{ id: string; title: string; action: string; observation?: string }>;
}
export const quizAnswerSchema = z.object({
  requestId: z.string().uuid(), version: z.number().int().nonnegative(),
  kind: z.enum(['point', 'choice', 'hint', 'next']),
  point: z.object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) }).strict().optional(),
  choiceId: z.string().max(64).optional(),
}).strict()
export type PhotoQuizAnswer = z.infer<typeof quizAnswerSchema>

/**
 * Insert dummy data into gallery/feed tables
 * ダミーデータ挿入スクリプト
 *
 * Run: npm run insert-dummy-data
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import type { Database } from './lib/database.types'

// Color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

const log = {
  success: (msg: string) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg: string) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  section: (msg: string) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}\n`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
}

// Supabase setup
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  log.error('Missing SUPABASE_URL')
  process.exit(1)
}

// Use service key if available, otherwise anon key
const supabaseKey = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY

if (!supabaseKey) {
  log.error('Missing Supabase key')
  process.exit(1)
}

const supabase = createClient<Database>(SUPABASE_URL, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Sample comment data
const sampleComments = [
  'この場所は本当に危険ですね。通学路として使っている子供たちが心配です。',
  '昨日ここを通りましたが、確かに危ないと感じました。早く改善してほしいです。',
  '詳細な報告ありがとうございます！参考になります。',
  '私も同じ場所で危険を感じていました。',
  '地域で対策を考える必要がありますね。',
  '市役所に報告したほうがいいかもしれません。',
  '写真を見るとよくわかります。注意して通ります。',
  'この情報を学校にも共有します。',
  '同じような場所が他にもありそうです。',
  '改善のための具体的な提案はありますか？',
]

async function insertDummyData() {
  log.section('Inserting Dummy Data')

  try {
    // Get existing users
    log.info('Getting existing users...')
    const { data: users, error: usersError } = await supabase
      .from('danger_reports')
      .select('user_id')
      .limit(10)

    if (usersError || !users || users.length === 0) {
      log.error('No users found in danger_reports')
      log.warning('Please create some danger reports first')
      return
    }

    const uniqueUserIds = [...new Set(users.map(u => u.user_id))]
    log.success(`Found ${uniqueUserIds.length} unique users`)

    // Get approved reports
    log.info('Getting approved reports...')
    const { data: reports, error: reportsError } = await supabase
      .from('danger_reports')
      .select('id, user_id, title')
      .eq('status', 'approved')
      .limit(10)

    if (reportsError || !reports || reports.length === 0) {
      log.error('No approved reports found')
      return
    }

    log.success(`Found ${reports.length} approved reports`)

    let totalInserted = 0

    // Insert bookmarks
    log.section('Inserting Bookmarks')
    const bookmarks: any[] = []
    reports.forEach((report, index) => {
      // Each report gets 0-2 bookmarks
      const numBookmarks = Math.floor(Math.random() * 3)
      for (let i = 0; i < numBookmarks; i++) {
        const randomUser = uniqueUserIds[Math.floor(Math.random() * uniqueUserIds.length)]
        bookmarks.push({
          user_id: randomUser,
          report_id: report.id,
        })
      }
    })

    if (bookmarks.length > 0) {
      const { error: bookmarksError } = await supabase
        .from('report_bookmarks')
        .upsert(bookmarks, { onConflict: 'user_id,report_id', ignoreDuplicates: true })

      if (bookmarksError) {
        log.warning(`Bookmarks error: ${bookmarksError.message}`)
      } else {
        log.success(`Inserted ${bookmarks.length} bookmarks`)
        totalInserted += bookmarks.length
      }
    }

    // Insert likes
    log.section('Inserting Likes')
    const likes: any[] = []
    reports.forEach((report) => {
      // Each report gets 1-5 likes
      const numLikes = Math.floor(Math.random() * 5) + 1
      for (let i = 0; i < numLikes; i++) {
        const randomUser = uniqueUserIds[Math.floor(Math.random() * uniqueUserIds.length)]
        likes.push({
          user_id: randomUser,
          report_id: report.id,
        })
      }
    })

    if (likes.length > 0) {
      const { error: likesError } = await supabase
        .from('report_likes')
        .upsert(likes, { onConflict: 'user_id,report_id', ignoreDuplicates: true })

      if (likesError) {
        log.warning(`Likes error: ${likesError.message}`)
      } else {
        log.success(`Inserted ${likes.length} likes`)
        totalInserted += likes.length
      }
    }

    // Insert comments
    log.section('Inserting Comments')
    const comments: any[] = []
    let commentIds: string[] = []

    reports.forEach((report) => {
      // Each report gets 1-4 comments
      const numComments = Math.floor(Math.random() * 4) + 1
      for (let i = 0; i < numComments; i++) {
        const randomUser = uniqueUserIds[Math.floor(Math.random() * uniqueUserIds.length)]
        const randomComment = sampleComments[Math.floor(Math.random() * sampleComments.length)]
        comments.push({
          user_id: randomUser,
          report_id: report.id,
          content: randomComment,
        })
      }
    })

    if (comments.length > 0) {
      const { data: insertedComments, error: commentsError } = await supabase
        .from('report_comments')
        .insert(comments)
        .select('id')

      if (commentsError) {
        log.warning(`Comments error: ${commentsError.message}`)
      } else {
        commentIds = insertedComments?.map((c: any) => c.id) || []
        log.success(`Inserted ${comments.length} comments`)
        totalInserted += comments.length
      }
    }

    // Insert reply comments (10-20% of comments get replies)
    if (commentIds.length > 0) {
      log.section('Inserting Reply Comments')
      const replies: any[] = []
      const numReplies = Math.floor(commentIds.length * 0.15)

      for (let i = 0; i < numReplies; i++) {
        const parentCommentId = commentIds[Math.floor(Math.random() * commentIds.length)]
        const randomUser = uniqueUserIds[Math.floor(Math.random() * uniqueUserIds.length)]

        // Get the report_id for this parent comment
        const { data: parentComment } = await supabase
          .from('report_comments')
          .select('report_id')
          .eq('id', parentCommentId)
          .single()

        if (parentComment) {
          replies.push({
            user_id: randomUser,
            report_id: parentComment.report_id,
            content: sampleComments[Math.floor(Math.random() * sampleComments.length)],
            parent_comment_id: parentCommentId,
          })
        }
      }

      if (replies.length > 0) {
        const { error: repliesError } = await supabase
          .from('report_comments')
          .insert(replies)

        if (repliesError) {
          log.warning(`Replies error: ${repliesError.message}`)
        } else {
          log.success(`Inserted ${replies.length} reply comments`)
          totalInserted += replies.length
        }
      }
    }

    // Insert shares
    log.section('Inserting Shares')
    const shares: any[] = []
    const platforms: Array<'twitter' | 'facebook' | 'line' | 'clipboard'> = ['twitter', 'facebook', 'line', 'clipboard']

    reports.forEach((report) => {
      // Each report gets 0-3 shares
      const numShares = Math.floor(Math.random() * 4)
      for (let i = 0; i < numShares; i++) {
        const randomUser = uniqueUserIds[Math.floor(Math.random() * uniqueUserIds.length)]
        const randomPlatform = platforms[Math.floor(Math.random() * platforms.length)]
        shares.push({
          user_id: randomUser,
          report_id: report.id,
          platform: randomPlatform,
        })
      }
    })

    if (shares.length > 0) {
      const { error: sharesError } = await supabase
        .from('report_shares')
        .insert(shares)

      if (sharesError) {
        log.warning(`Shares error: ${sharesError.message}`)
      } else {
        log.success(`Inserted ${shares.length} shares`)
        totalInserted += shares.length
      }
    }

    // Summary
    log.section('Summary')
    log.success(`Total items inserted: ${totalInserted}`)
    log.info('Breakdown:')
    log.info(`  Bookmarks: ${bookmarks.length}`)
    log.info(`  Likes: ${likes.length}`)
    log.info(`  Comments: ${comments.length}`)
    log.info(`  Shares: ${shares.length}`)

    // Verify data
    log.section('Verifying Data')
    const { data: stats, error: statsError } = await supabase
      .from('report_stats' as any)
      .select('*')
      .order('likes_count', { ascending: false })
      .limit(5)

    if (!statsError && stats) {
      log.success('Top 5 reports by likes:')
      stats.forEach((stat: any, index: number) => {
        log.info(`  ${index + 1}. Report ${stat.report_id.substring(0, 8)}... - ${stat.likes_count} likes, ${stat.comments_count} comments`)
      })
    }

  } catch (err) {
    log.error(`Error: ${err}`)
  }
}

// Run
log.info('Starting dummy data insertion...')
insertDummyData().then(() => {
  log.success('\n✨ Dummy data insertion complete!')
  log.info('Run "npm run test:gallery-api" to verify the data')
}).catch((err) => {
  log.error(`\nFailed: ${err}`)
  process.exit(1)
})

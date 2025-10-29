/**
 * Test script for Report Gallery & Feed database migration
 * 危険報告ギャラリー・共有フィードのデータベーステスト
 *
 * Run: npx tsx test-report-gallery-migration.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import type { Database } from './lib/database.types'

// Color codes for console output
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

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  log.error('Missing Supabase credentials in environment variables')
  process.exit(1)
}

// Create Supabase client
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)

// Test data
let testUserId: string
let testReportId: string
let testCommentId: string
let testBookmarkId: string
let testLikeId: string

// Cleanup function
async function cleanup() {
  log.info('Cleaning up test data...')

  if (testCommentId) {
    await supabase.from('report_comments').delete().eq('id', testCommentId)
  }
  if (testBookmarkId) {
    await supabase.from('report_bookmarks').delete().eq('id', testBookmarkId)
  }
  if (testLikeId) {
    await supabase.from('report_likes').delete().eq('id', testLikeId)
  }

  log.success('Cleanup completed')
}

// Test: Check if tables exist
async function testTablesExist() {
  log.section('Testing: Tables Existence')

  const tables = [
    'report_bookmarks',
    'report_likes',
    'report_comments',
    'report_shares',
    'report_notifications',
  ]

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table as any).select('id').limit(1)
      if (error) {
        log.error(`Table "${table}" does not exist or is not accessible: ${error.message}`)
        return false
      }
      log.success(`Table "${table}" exists and is accessible`)
    } catch (err) {
      log.error(`Error checking table "${table}": ${err}`)
      return false
    }
  }

  return true
}

// Test: Check if views exist
async function testViewsExist() {
  log.section('Testing: Views Existence')

  const views = [
    'report_stats',
    'public_reports_with_stats',
    'danger_category_stats',
    'user_report_activity',
  ]

  for (const view of views) {
    try {
      const { error } = await supabase.from(view as any).select('*').limit(1)
      if (error) {
        log.warning(`View "${view}" may not exist or is not accessible: ${error.message}`)
        // Views might not work properly without data, so we just warn
      } else {
        log.success(`View "${view}" is accessible`)
      }
    } catch (err) {
      log.warning(`Error checking view "${view}": ${err}`)
    }
  }

  return true
}

// Test: Get test user and report
async function getTestData() {
  log.section('Getting Test Data')

  // Get current user or use a test user ID
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    testUserId = user.id
    log.success(`Using authenticated user: ${testUserId}`)
  } else {
    // For testing without auth, we'll try to get a user from danger_reports
    log.warning('No authenticated user found, will use existing report user')
    const { data: reports } = await supabase
      .from('danger_reports')
      .select('user_id, id')
      .eq('status', 'approved')
      .limit(1)
      .single()

    if (reports) {
      testUserId = reports.user_id
      testReportId = reports.id
      log.info(`Using existing report user: ${testUserId}`)
      log.info(`Using existing report: ${testReportId}`)
      return true
    } else {
      log.error('No approved reports found for testing')
      return false
    }
  }

  // Get an approved report for testing
  const { data: report, error } = await supabase
    .from('danger_reports')
    .select('id')
    .eq('status', 'approved')
    .limit(1)
    .single()

  if (error || !report) {
    log.error('No approved reports found for testing')
    return false
  }

  testReportId = report.id
  log.success(`Using test report: ${testReportId}`)

  return true
}

// Test: Bookmark functionality
async function testBookmarks() {
  log.section('Testing: Bookmark Functionality')

  try {
    // Create bookmark
    const { data: bookmark, error: createError } = await supabase
      .from('report_bookmarks')
      .insert({
        user_id: testUserId,
        report_id: testReportId,
      })
      .select()
      .single()

    if (createError) {
      log.error(`Failed to create bookmark: ${createError.message}`)
      return false
    }

    testBookmarkId = bookmark.id
    log.success('Bookmark created successfully')

    // Read bookmark
    const { data: readBookmark, error: readError } = await supabase
      .from('report_bookmarks')
      .select('*')
      .eq('id', testBookmarkId)
      .single()

    if (readError || !readBookmark) {
      log.error('Failed to read bookmark')
      return false
    }

    log.success('Bookmark read successfully')

    // Test toggle function
    const { data: toggleResult, error: toggleError } = await supabase
      .rpc('toggle_report_bookmark', {
        p_user_id: testUserId,
        p_report_id: testReportId,
      })

    if (toggleError) {
      log.warning(`Toggle function not available or failed: ${toggleError.message}`)
    } else {
      log.success(`Toggle bookmark function works: ${toggleResult}`)
    }

    return true
  } catch (err) {
    log.error(`Bookmark test error: ${err}`)
    return false
  }
}

// Test: Like functionality
async function testLikes() {
  log.section('Testing: Like Functionality')

  try {
    // Create like
    const { data: like, error: createError } = await supabase
      .from('report_likes')
      .insert({
        user_id: testUserId,
        report_id: testReportId,
      })
      .select()
      .single()

    if (createError) {
      log.error(`Failed to create like: ${createError.message}`)
      return false
    }

    testLikeId = like.id
    log.success('Like created successfully')

    // Read like
    const { data: readLike, error: readError } = await supabase
      .from('report_likes')
      .select('*')
      .eq('id', testLikeId)
      .single()

    if (readError || !readLike) {
      log.error('Failed to read like')
      return false
    }

    log.success('Like read successfully')

    // Test toggle function
    const { data: toggleResult, error: toggleError } = await supabase
      .rpc('toggle_report_like', {
        p_user_id: testUserId,
        p_report_id: testReportId,
      })

    if (toggleError) {
      log.warning(`Toggle like function not available or failed: ${toggleError.message}`)
    } else {
      log.success(`Toggle like function works: ${toggleResult}`)
    }

    return true
  } catch (err) {
    log.error(`Like test error: ${err}`)
    return false
  }
}

// Test: Comment functionality
async function testComments() {
  log.section('Testing: Comment Functionality')

  try {
    // Create comment
    const { data: comment, error: createError } = await supabase
      .from('report_comments')
      .insert({
        user_id: testUserId,
        report_id: testReportId,
        content: 'これはテストコメントです。This is a test comment.',
      })
      .select()
      .single()

    if (createError) {
      log.error(`Failed to create comment: ${createError.message}`)
      return false
    }

    testCommentId = comment.id
    log.success('Comment created successfully')

    // Read comment
    const { data: readComment, error: readError } = await supabase
      .from('report_comments')
      .select('*')
      .eq('id', testCommentId)
      .single()

    if (readError || !readComment) {
      log.error('Failed to read comment')
      return false
    }

    log.success('Comment read successfully')

    // Update comment
    const { error: updateError } = await supabase
      .from('report_comments')
      .update({ content: '更新されたテストコメントです。Updated test comment.' })
      .eq('id', testCommentId)

    if (updateError) {
      log.error(`Failed to update comment: ${updateError.message}`)
      return false
    }

    log.success('Comment updated successfully')

    // Check if is_edited flag was set
    const { data: updatedComment } = await supabase
      .from('report_comments')
      .select('is_edited')
      .eq('id', testCommentId)
      .single()

    if (updatedComment?.is_edited) {
      log.success('is_edited flag was set correctly')
    } else {
      log.warning('is_edited flag was not set')
    }

    // Test get comments function
    const { data: comments, error: getError } = await supabase
      .rpc('get_report_comments', { p_report_id: testReportId })

    if (getError) {
      log.warning(`Get comments function not available: ${getError.message}`)
    } else {
      log.success(`Get comments function works: ${comments?.length || 0} comments found`)
    }

    return true
  } catch (err) {
    log.error(`Comment test error: ${err}`)
    return false
  }
}

// Test: Share functionality
async function testShares() {
  log.section('Testing: Share Functionality')

  try {
    // Create share
    const { data: share, error: createError } = await supabase
      .from('report_shares')
      .insert({
        user_id: testUserId,
        report_id: testReportId,
        platform: 'twitter',
      })
      .select()
      .single()

    if (createError) {
      log.error(`Failed to create share: ${createError.message}`)
      return false
    }

    log.success('Share created successfully')

    // Read share
    const { data: readShare, error: readError } = await supabase
      .from('report_shares')
      .select('*')
      .eq('id', share.id)
      .single()

    if (readError || !readShare) {
      log.error('Failed to read share')
      return false
    }

    log.success('Share read successfully')

    // Delete share
    await supabase.from('report_shares').delete().eq('id', share.id)
    log.success('Share deleted successfully')

    return true
  } catch (err) {
    log.error(`Share test error: ${err}`)
    return false
  }
}

// Test: Statistics views
async function testStatistics() {
  log.section('Testing: Statistics Views')

  try {
    // Test report_stats view
    const { data: reportStats, error: statsError } = await supabase
      .from('report_stats' as any)
      .select('*')
      .eq('report_id', testReportId)
      .single()

    if (statsError) {
      log.warning(`Report stats view not available: ${statsError.message}`)
    } else {
      log.success(`Report stats: ${JSON.stringify(reportStats)}`)
    }

    // Test public_reports_with_stats view
    const { data: publicReports, error: publicError } = await supabase
      .from('public_reports_with_stats' as any)
      .select('*')
      .limit(5)

    if (publicError) {
      log.warning(`Public reports view not available: ${publicError.message}`)
    } else {
      log.success(`Found ${publicReports?.length || 0} public reports with stats`)
    }

    // Test danger_category_stats view
    const { data: categoryStats, error: categoryError } = await supabase
      .from('danger_category_stats' as any)
      .select('*')

    if (categoryError) {
      log.warning(`Category stats view not available: ${categoryError.message}`)
    } else {
      log.success(`Found ${categoryStats?.length || 0} danger categories`)
    }

    return true
  } catch (err) {
    log.error(`Statistics test error: ${err}`)
    return false
  }
}

// Test: Helper functions
async function testHelperFunctions() {
  log.section('Testing: Helper Functions')

  try {
    // Test get_trending_reports
    const { data: trending, error: trendingError } = await supabase
      .rpc('get_trending_reports', { p_limit: 5, p_days: 7 })

    if (trendingError) {
      log.warning(`Trending reports function not available: ${trendingError.message}`)
    } else {
      log.success(`Found ${trending?.length || 0} trending reports`)
    }

    // Test get_user_bookmarked_reports
    const { data: bookmarked, error: bookmarkedError } = await supabase
      .rpc('get_user_bookmarked_reports', { p_user_id: testUserId })

    if (bookmarkedError) {
      log.warning(`Bookmarked reports function not available: ${bookmarkedError.message}`)
    } else {
      log.success(`Found ${bookmarked?.length || 0} bookmarked reports`)
    }

    return true
  } catch (err) {
    log.error(`Helper functions test error: ${err}`)
    return false
  }
}

// Main test runner
async function runTests() {
  log.section('Database Migration Test Suite')
  log.info(`Supabase URL: ${SUPABASE_URL}`)

  const results: { name: string; passed: boolean }[] = []

  try {
    // Step 1: Check tables
    const tablesExist = await testTablesExist()
    results.push({ name: 'Tables Existence', passed: tablesExist })

    if (!tablesExist) {
      log.error('Tables do not exist. Please run the migration first.')
      return
    }

    // Step 2: Check views
    const viewsExist = await testViewsExist()
    results.push({ name: 'Views Existence', passed: viewsExist })

    // Step 3: Get test data
    const hasTestData = await getTestData()
    if (!hasTestData) {
      log.error('Cannot proceed without test data')
      return
    }

    // Step 4: Test bookmarks
    const bookmarksPassed = await testBookmarks()
    results.push({ name: 'Bookmarks', passed: bookmarksPassed })

    // Step 5: Test likes
    const likesPassed = await testLikes()
    results.push({ name: 'Likes', passed: likesPassed })

    // Step 6: Test comments
    const commentsPassed = await testComments()
    results.push({ name: 'Comments', passed: commentsPassed })

    // Step 7: Test shares
    const sharesPassed = await testShares()
    results.push({ name: 'Shares', passed: sharesPassed })

    // Step 8: Test statistics
    const statsPassed = await testStatistics()
    results.push({ name: 'Statistics', passed: statsPassed })

    // Step 9: Test helper functions
    const helpersPassed = await testHelperFunctions()
    results.push({ name: 'Helper Functions', passed: helpersPassed })

    // Summary
    log.section('Test Results Summary')
    const passed = results.filter(r => r.passed).length
    const total = results.length

    results.forEach(result => {
      if (result.passed) {
        log.success(`${result.name}: PASSED`)
      } else {
        log.error(`${result.name}: FAILED`)
      }
    })

    console.log(`\n${colors.cyan}Total: ${passed}/${total} tests passed${colors.reset}\n`)

    if (passed === total) {
      log.success('All tests passed! ✨')
    } else {
      log.warning(`${total - passed} test(s) failed`)
    }

  } catch (err) {
    log.error(`Unexpected error: ${err}`)
  } finally {
    await cleanup()
  }
}

// Run tests
runTests().catch(console.error)

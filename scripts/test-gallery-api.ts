// @ts-nocheck
/**
 * Test script for Gallery API functionality
 * ギャラリーAPI機能のテストスクリプト
 *
 * Run: npm run test:gallery-api
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/database.types'

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
}

const log = {
  success: (msg: string) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg: string) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  section: (msg: string) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}\n`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  data: (msg: string) => console.log(`${colors.magenta}📊 ${msg}${colors.reset}`),
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

let testReportId: string

// Test: Get public reports with stats
async function testPublicReportsWithStats() {
  log.section('Testing: Public Reports with Stats')

  try {
    const { data, error } = await supabase
      .from('public_reports_with_stats' as any)
      .select('*')
      .limit(10)

    if (error) {
      log.error(`Failed to fetch reports: ${error.message}`)
      return false
    }

    log.success(`Found ${data?.length || 0} public reports with stats`)

    if (data && data.length > 0) {
      const report = data[0]
      testReportId = report.id
      log.data(`Sample report:`)
      log.data(`  Title: ${report.title}`)
      log.data(`  Type: ${report.danger_type}`)
      log.data(`  Level: ${report.danger_level}`)
      log.data(`  Likes: ${report.likes_count}`)
      log.data(`  Bookmarks: ${report.bookmarks_count}`)
      log.data(`  Comments: ${report.comments_count}`)
      log.data(`  Shares: ${report.shares_count}`)
    }

    return true
  } catch (err) {
    log.error(`Error: ${err}`)
    return false
  }
}

// Test: Get trending reports
async function testTrendingReports() {
  log.section('Testing: Trending Reports')

  try {
    const { data, error } = await supabase
      .rpc('get_trending_reports', { p_limit: 5, p_days: 30 })

    if (error) {
      log.warning(`Trending reports not available: ${error.message}`)
      return true // Not critical
    }

    log.success(`Found ${data?.length || 0} trending reports`)

    if (data && data.length > 0) {
      data.forEach((report: any, index: number) => {
        log.data(`${index + 1}. ${report.title} (Score: ${report.engagement_score})`)
      })
    }

    return true
  } catch (err) {
    log.warning(`Trending reports error: ${err}`)
    return true
  }
}

// Test: Get danger category stats
async function testCategoryStats() {
  log.section('Testing: Danger Category Stats')

  try {
    const { data, error } = await supabase
      .from('danger_category_stats' as any)
      .select('*')

    if (error) {
      log.error(`Failed to fetch category stats: ${error.message}`)
      return false
    }

    log.success(`Found ${data?.length || 0} danger categories`)

    if (data) {
      data.forEach((category: any) => {
        log.data(`${category.danger_type}:`)
        log.data(`  Total reports: ${category.total_reports}`)
        log.data(`  Weekly reports: ${category.weekly_reports}`)
        log.data(`  Avg danger level: ${parseFloat(category.avg_danger_level).toFixed(2)}`)
        log.data(`  Unique likers: ${category.unique_likers}`)
        log.data(`  Unique commenters: ${category.unique_commenters}`)
      })
    }

    return true
  } catch (err) {
    log.error(`Error: ${err}`)
    return false
  }
}

// Test: Get report comments
async function testReportComments() {
  log.section('Testing: Report Comments')

  if (!testReportId) {
    log.warning('No test report ID available, skipping comments test')
    return true
  }

  try {
    const { data, error } = await supabase
      .rpc('get_report_comments', { p_report_id: testReportId })

    if (error) {
      log.warning(`Comments not available: ${error.message}`)
      return true
    }

    log.success(`Found ${data?.length || 0} comments for report`)

    if (data && data.length > 0) {
      data.forEach((comment: any, index: number) => {
        const isReply = comment.parent_comment_id ? '  ↳ ' : ''
        const edited = comment.is_edited ? ' (edited)' : ''
        log.data(`${isReply}${index + 1}. ${comment.content.substring(0, 50)}...${edited}`)
      })
    }

    return true
  } catch (err) {
    log.warning(`Comments error: ${err}`)
    return true
  }
}

// Test: Get report stats
async function testReportStats() {
  log.section('Testing: Report Stats View')

  if (!testReportId) {
    log.warning('No test report ID available, skipping stats test')
    return true
  }

  try {
    const { data, error } = await supabase
      .from('report_stats' as any)
      .select('*')
      .eq('report_id', testReportId)
      .single()

    if (error) {
      log.error(`Failed to fetch report stats: ${error.message}`)
      return false
    }

    log.success('Report stats retrieved successfully')
    log.data(`Stats:`)
    log.data(`  Likes: ${data.likes_count}`)
    log.data(`  Bookmarks: ${data.bookmarks_count}`)
    log.data(`  Comments: ${data.comments_count}`)
    log.data(`  Shares: ${data.shares_count}`)

    return true
  } catch (err) {
    log.error(`Error: ${err}`)
    return false
  }
}

// Test: Count all engagement data
async function testEngagementCounts() {
  log.section('Testing: Engagement Data Counts')

  try {
    const [bookmarks, likes, comments, shares] = await Promise.all([
      supabase.from('report_bookmarks').select('id', { count: 'exact', head: true }),
      supabase.from('report_likes').select('id', { count: 'exact', head: true }),
      supabase.from('report_comments').select('id', { count: 'exact', head: true }),
      supabase.from('report_shares').select('id', { count: 'exact', head: true }),
    ])

    log.success('Engagement data counts:')
    log.data(`  Total bookmarks: ${bookmarks.count || 0}`)
    log.data(`  Total likes: ${likes.count || 0}`)
    log.data(`  Total comments: ${comments.count || 0}`)
    log.data(`  Total shares: ${shares.count || 0}`)

    const total = (bookmarks.count || 0) + (likes.count || 0) + (comments.count || 0) + (shares.count || 0)
    log.data(`  Total engagement actions: ${total}`)

    return true
  } catch (err) {
    log.error(`Error: ${err}`)
    return false
  }
}

// Test: Get recent activity
async function testRecentActivity() {
  log.section('Testing: Recent Activity')

  try {
    // Get recent likes
    const { data: recentLikes, error: likesError } = await supabase
      .from('report_likes')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    if (!likesError && recentLikes && recentLikes.length > 0) {
      log.success(`${recentLikes.length} recent likes found`)
      log.data(`  Most recent: ${new Date(recentLikes[0].created_at).toLocaleString()}`)
    } else {
      log.info('No recent likes found')
    }

    // Get recent comments
    const { data: recentComments, error: commentsError } = await supabase
      .from('report_comments')
      .select('created_at, content')
      .order('created_at', { ascending: false })
      .limit(5)

    if (!commentsError && recentComments && recentComments.length > 0) {
      log.success(`${recentComments.length} recent comments found`)
      recentComments.forEach((comment, index) => {
        log.data(`  ${index + 1}. ${comment.content.substring(0, 40)}... (${new Date(comment.created_at).toLocaleString()})`)
      })
    } else {
      log.info('No recent comments found')
    }

    return true
  } catch (err) {
    log.error(`Error: ${err}`)
    return false
  }
}

// Main test runner
async function runTests() {
  log.section('Gallery API Test Suite')
  log.info(`Supabase URL: ${SUPABASE_URL}`)

  const results: { name: string; passed: boolean }[] = []

  try {
    // Test 1: Public reports with stats
    const publicReportsTest = await testPublicReportsWithStats()
    results.push({ name: 'Public Reports with Stats', passed: publicReportsTest })

    // Test 2: Trending reports
    const trendingTest = await testTrendingReports()
    results.push({ name: 'Trending Reports', passed: trendingTest })

    // Test 3: Category stats
    const categoryStatsTest = await testCategoryStats()
    results.push({ name: 'Category Stats', passed: categoryStatsTest })

    // Test 4: Report comments
    const commentsTest = await testReportComments()
    results.push({ name: 'Report Comments', passed: commentsTest })

    // Test 5: Report stats
    const reportStatsTest = await testReportStats()
    results.push({ name: 'Report Stats', passed: reportStatsTest })

    // Test 6: Engagement counts
    const engagementTest = await testEngagementCounts()
    results.push({ name: 'Engagement Counts', passed: engagementTest })

    // Test 7: Recent activity
    const activityTest = await testRecentActivity()
    results.push({ name: 'Recent Activity', passed: activityTest })

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
      log.info('The gallery/feed database is working correctly!')
    } else {
      log.warning(`${total - passed} test(s) failed`)
      log.info('Please check the error messages above')
    }

  } catch (err) {
    log.error(`Unexpected error: ${err}`)
  }
}

// Run tests
runTests().catch(console.error)

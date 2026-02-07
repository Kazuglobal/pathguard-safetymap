/**
 * Apply database migration to Supabase
 * データベースマイグレーションをSupabaseに適用
 *
 * Run: npm run apply-migration
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  console.error('❌ Missing SUPABASE_URL in environment variables')
  process.exit(1)
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('⚠️  Missing SUPABASE_SERVICE_ROLE_KEY - using ANON key (limited permissions)')
  console.log('ℹ️  For full migration, please add SUPABASE_SERVICE_ROLE_KEY to .env.local')
  console.log('ℹ️  You can find it in Supabase Dashboard > Settings > API > service_role key')
  console.log('\n📋 Please copy the SQL file content and run it manually in Supabase SQL Editor:')
  console.log('   https://supabase.com/dashboard/project/_/sql/new')
  console.log('\n📄 SQL file location: database-migration-report-gallery-feed.sql\n')
  process.exit(1)
}

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyMigration() {
  try {
    console.log('📖 Reading migration file...')
    const sqlContent = readFileSync(
      resolve(process.cwd(), 'database-migration-report-gallery-feed.sql'),
      'utf-8'
    )

    console.log('🚀 Applying migration to Supabase...')
    console.log(`   Database: ${SUPABASE_URL}`)

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent })

    if (error) {
      console.error('❌ Migration failed:', error.message)
      console.log('\n📋 Please run the migration manually in Supabase SQL Editor:')
      console.log('   1. Go to https://supabase.com/dashboard/project/_/sql/new')
      console.log('   2. Copy the content from: database-migration-report-gallery-feed.sql')
      console.log('   3. Paste and run in SQL Editor')
      process.exit(1)
    }

    console.log('✅ Migration applied successfully!')
    console.log('\n📊 Next steps:')
    console.log('   1. Run tests: npm run test:db-migration')
    console.log('   2. Verify tables in Supabase Dashboard')
    console.log('   3. Check RLS policies are working correctly')

  } catch (err) {
    console.error('❌ Error applying migration:', err)
    console.log('\n📋 Manual migration required. Please:')
    console.log('   1. Go to https://supabase.com/dashboard/project/_/sql/new')
    console.log('   2. Copy the content from: database-migration-report-gallery-feed.sql')
    console.log('   3. Paste and run in SQL Editor')
    process.exit(1)
  }
}

applyMigration()

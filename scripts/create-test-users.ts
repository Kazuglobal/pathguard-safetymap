import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? 'set' : 'missing')
  console.error('- SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'missing')
  process.exit(1)
}

const TEST_USERS = [
  { email: 'admin@test.com', password: 'testpassword123' },
  { email: 'user@test.com', password: 'testpassword123' },
  { email: 'student@test.com', password: 'testpassword123' },
  { email: 'demo@example.com', password: 'demopassword' },
]

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  console.log('Creating test users...\n')

  for (const user of TEST_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    })

    if (error) {
      if (error.message.includes('already') || error.message.includes('exists')) {
        console.log(`✓ ${user.email} (already exists)`)
      } else {
        console.error(`✗ ${user.email}: ${error.message}`)
      }
    } else {
      console.log(`✓ ${user.email} (created, id: ${data.user?.id})`)
    }
  }

  console.log('\nDone.')
}

main().catch(console.error)

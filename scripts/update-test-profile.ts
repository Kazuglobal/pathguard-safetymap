import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Get user ID for user@test.com
  const { data: authData } = await supabase.auth.admin.listUsers()
  const testUser = authData?.users?.find(u => u.email === 'user@test.com')

  if (!testUser) {
    console.log('Test user not found')
    return
  }

  console.log('User ID:', testUser.id)

  // Update profile
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: testUser.id,
      email: testUser.email,
      display_name: 'TEST USER',
      full_name: 'Test User',
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Profile updated successfully')
  }
}

main().catch(console.error)

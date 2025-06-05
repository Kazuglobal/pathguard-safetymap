import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "./database.types"

export const createBrowserClient = () => createClientComponentClient<Database>()

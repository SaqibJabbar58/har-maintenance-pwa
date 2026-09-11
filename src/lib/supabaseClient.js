import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Approval threshold in PKR — mirrors the DB trigger in schema.sql
export const APPROVAL_THRESHOLD = 20000

// Upload a file (photo or voice note) to a Storage bucket and return its public URL
export async function uploadToBucket(bucket, file, pathPrefix = '') {
  const ext = file.name?.split('.').pop() || 'webm'
  const path = `${pathPrefix}${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

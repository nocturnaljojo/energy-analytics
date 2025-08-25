import { createClient } from '@supabase/supabase-js'

// Temporarily hard-code to test connection
const supabaseUrl = 'https://nhqvoonwzlzgmrawwfis.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocXZvb253emx6Z21yYXd3ZmlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MDE2MDIsImV4cCI6MjA3MTQ3NzYwMn0.OCxz_H1Jfgdj2h3hQ-EX73ifTi7QHajDahmByFBk9Nk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Test function to check connection
export async function testConnection() {
  try {
    // First, test if we can connect at all
    const { data: test, error: testError } = await supabase
      .from('dispatch_unit_scada')
      .select('count')
      .limit(1)
    
    if (testError) {
      console.error('Supabase error details:', testError)
      
      // Try a simpler query - just list tables
      const { data: tables, error: tableError } = await supabase
        .rpc('get_tables', {})
        .single()
      
      if (tableError) {
        console.error('Cannot list tables:', tableError)
      }
      
      return false
    }
    
    console.log('Supabase connected! Count result:', test)
    return true
  } catch (err) {
    console.error('Connection failed:', err)
    return false
  }
}
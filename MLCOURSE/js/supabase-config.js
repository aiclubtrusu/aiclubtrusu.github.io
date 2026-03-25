// Supabase Configuration
const SUPABASE_URL = 'https://mzafqmmwxgdgzijdegbv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_puipfl2mW725aJfLn1kOLw_9Ukr2cLW';

// Initialize Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

console.log('Supabase client initialized');

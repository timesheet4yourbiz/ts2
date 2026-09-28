// Menggunakan Supabase dari CDN untuk Vanilla JS (ES Modules)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// TODO: Gantikan dengan URL dan Key dari dashboard Supabase anda
const supabaseUrl = 'https://nuavogeysagresrzqigf.supabase.co'; 
const supabaseKey = 'sb_publishable_1Syyg8qDWanFC_9uruaSig_BQWkioYR';

export const supabase = createClient(supabaseUrl, supabaseKey);

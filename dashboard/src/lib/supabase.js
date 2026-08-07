import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  document.body.innerHTML = '<pre style="color:#f87171;padding:40px;font:14px monospace">'
    + 'Dashboard is not configured.\n\n'
    + 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY\n'
    + '(repo Actions variables for the Pages build, or dashboard/.env.local for dev)\n'
    + 'and rebuild. See docs/mobile-setup.md.</pre>';
  throw new Error('missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anonKey);

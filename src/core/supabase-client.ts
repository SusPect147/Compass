// @ts-nocheck

await new Promise((resolve, reject) => {
    if (window.supabase) return resolve();
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
});

const SUPABASE_URL = 'https://zzajradnutrwkkxekqic.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6YWpyYWRudXRyd2treGVrcWljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODUyNzQsImV4cCI6MjA5NDE2MTI3NH0.eKAIPBks4ABuU4IVehXxP6DmnSYlAnKDlB_Ss6wkjGU';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

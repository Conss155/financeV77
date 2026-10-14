// ====== STEP 1: paste your Supabase project details here ======
// Supabase Dashboard -> Project Settings -> API
const SUPABASE_URL = "https://rvnyrtyxqwczqeixmxas.supabase.co/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2bnlydHl4cXdjenFlaXhteGFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDI4NTcsImV4cCI6MjEwNzQ3ODg1N30.ZPpXRzAZnKCy8DqwHvCb0_afVmZ_JIf-EFkATvHVvEk";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- shared helpers ----------
const peso = n => '₱' + Number(n || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH', {month: 'short', day: 'numeric', year: 'numeric'}) : '—';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = s => document.querySelector(s);
const TERMS = ['prelim', 'midterm', 'finals'];
const TERM_NAME = {prelim: 'Prelim', midterm: 'Midterm', finals: 'Finals'};

function toast(t) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = t;
  document.body.appendChild(d); setTimeout(() => d.remove(), 3000);
}
function openModal(html, wide) {
  $('#modalBox').className = 'box' + (wide ? ' wide' : '');
  $('#modalBox').innerHTML = html; $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }

// balance/status of one fee row given its payments
function feeInfo(fee, payments) {
  const paid = payments.filter(p => p.fee_id === fee.id && p.status === 'success').reduce((a, p) => a + Number(p.amount), 0);
  const balance = Math.max(0, Number(fee.amount) - paid);
  const today = new Date(new Date().toDateString());
  let status = balance <= 0 ? 'paid' : new Date(fee.due_date) < today ? 'overdue' : paid > 0 ? 'partial' : 'unpaid';
  const days = Math.ceil((new Date(fee.due_date) - today) / 864e5);
  return {paid, balance, status, days};
}
const LABEL = {paid: 'Paid', overdue: 'Overdue', partial: 'Partial', unpaid: 'Unpaid'};

// Guard: returns {user, profile, role} or redirects to login
async function requireRole(role) {
  const {data: {user}} = await sb.auth.getUser();
  if (!user) { location.href = 'index.html'; return null; }
  const [{data: profile}, {data: roles}] = await Promise.all([
    sb.from('profiles').select('*').eq('id', user.id).single(),
    sb.from('user_roles').select('role').eq('user_id', user.id)
  ]);
  const isAdmin = (roles || []).some(r => r.role === 'admin');
  const actual = isAdmin ? 'admin' : 'student';
  if (actual !== role) { location.href = isAdmin ? 'admin.html' : 'student.html'; return null; }
  return {user, profile, role: actual};
}
async function logout() { await sb.auth.signOut(); location.href = 'index.html'; }

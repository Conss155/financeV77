const forms = {login: $('#loginForm'), signup: $('#signupForm'), forgot: $('#forgotForm')};
function show(name) {
  Object.entries(forms).forEach(([k, f]) => f.classList.toggle('hide', k !== name));
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.t === name));
  $('#tabs').classList.toggle('hide', name === 'forgot');
  msg('');
}
function msg(text, type = 'err') { const m = $('#msg'); m.textContent = text; m.className = 'msg ' + type + (text ? ' show' : ''); }
function busy(form, on) { const b = form.querySelector('button[type=submit]'); b.disabled = on; }

document.querySelectorAll('#tabs a').forEach(a => a.onclick = () => show(a.dataset.t));
$('#toForgot').onclick = () => show('forgot');
$('#backLogin').onclick = () => show('login');

async function goByRole(userId) {
  const {data} = await sb.from('user_roles').select('role').eq('user_id', userId);
  location.href = (data || []).some(r => r.role === 'admin') ? 'admin.html' : 'student.html';
}

// already logged in? go straight to the right page
sb.auth.getUser().then(({data: {user}}) => { if (user) goByRole(user.id); });

forms.login.onsubmit = async e => {
  e.preventDefault(); busy(forms.login, true); msg('');
  const {data, error} = await sb.auth.signInWithPassword({email: $('#lEmail').value.trim(), password: $('#lPass').value});
  busy(forms.login, false);
  if (error) return msg(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
  goByRole(data.user.id);
};

forms.signup.onsubmit = async e => {
  e.preventDefault(); msg('');
  if ($('#sPass').value !== $('#sPass2').value) return msg('Passwords do not match.');
  busy(forms.signup, true);
  const {data, error} = await sb.auth.signUp({
    email: $('#sEmail').value.trim(), password: $('#sPass').value,
    options: {
      emailRedirectTo: location.origin + location.pathname,
      data: {full_name: $('#sName').value.trim(), student_no: $('#sNo').value.trim(), course: $('#sCourse').value, year_level: $('#sYear').value}
    }
  });
  busy(forms.signup, false);
  if (error) return msg(error.message);
  if (data.session) return goByRole(data.user.id);
  forms.signup.reset(); show('login');
  msg('Account created! Check your email to confirm your account, then log in.', 'ok');
};

forms.forgot.onsubmit = async e => {
  e.preventDefault(); busy(forms.forgot, true);
  const url = location.href.replace(/[^/]*$/, '') + 'reset-password.html';
  const {error} = await sb.auth.resetPasswordForEmail($('#fEmail').value.trim(), {redirectTo: url});
  busy(forms.forgot, false);
  if (error) return msg(error.message);
  msg('Reset link sent! Check your email inbox.', 'ok');
};

// ---------- DEMO BUTTONS (real accounts, data is saved) ----------
const DEMO = {
  student: {email: 'demo.student@fullbright.edu', password: 'Demo@12345',
            data: {full_name: 'Juan Dela Cruz (Demo)', student_no: '2026-DEMO1', course: 'BSIT', year_level: '1st Year'}},
  admin:   {email: 'demo.admin@fullbright.edu', password: 'Demo@12345',
            data: {full_name: 'Finance Admin (Demo)', student_no: null, course: null, year_level: null}}
};
document.querySelectorAll('[data-demo]').forEach(btn => btn.onclick = async () => {
  const acc = DEMO[btn.dataset.demo];
  const all = document.querySelectorAll('[data-demo]');
  all.forEach(b => b.disabled = true); msg('Opening demo account...', 'ok');
  let {data, error} = await sb.auth.signInWithPassword({email: acc.email, password: acc.password});
  if (error) {
    // first time: create the demo account, then log in
    const up = await sb.auth.signUp({email: acc.email, password: acc.password, options: {data: acc.data}});
    if (up.error && !/registered/i.test(up.error.message)) { all.forEach(b => b.disabled = false); return msg(up.error.message); }
    ({data, error} = await sb.auth.signInWithPassword({email: acc.email, password: acc.password}));
  }
  all.forEach(b => b.disabled = false);
  if (error) return msg(/confirm/i.test(error.message)
    ? 'Demo account not confirmed. Run demo-setup.sql in Supabase SQL Editor first.'
    : error.message);
  goByRole(data.user.id);
});

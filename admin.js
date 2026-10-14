let ME, D = {students: [], fees: [], payments: [], grades: [], notifs: []}, current = 'dashboard', filt = {q: '', student: ''};

async function load() {
  const [s, r, f, p, g, n] = await Promise.all([
    sb.from('profiles').select('*').order('full_name'),
    sb.from('user_roles').select('user_id,role'),
    sb.from('fees').select('*').order('due_date'),
    sb.from('payments').select('*').order('created_at', {ascending: false}),
    sb.from('grades').select('*').order('subject_code'),
    sb.from('notifications').select('*').order('created_at', {ascending: false}).limit(200)
  ]);
  const admins = new Set((r.data || []).filter(x => x.role === 'admin').map(x => x.user_id));
  D = {students: (s.data || []).filter(x => !admins.has(x.id)), fees: f.data || [], payments: p.data || [], grades: g.data || [], notifs: n.data || []};
}
const stu = id => D.students.find(s => s.id === id) || {full_name: '(unknown)'};
const okPays = () => D.payments.filter(p => p.status === 'success');
function studentTotals(id) {
  const fees = D.fees.filter(f => f.student_id === id), total = fees.reduce((a, f) => a + Number(f.amount), 0);
  const paid = fees.reduce((a, f) => a + feeInfo(f, D.payments).paid, 0);
  return {total, paid, bal: total - paid, overdue: fees.some(f => feeInfo(f, D.payments).status === 'overdue')};
}
function stat(i, bg, l, v) { return `<div class="card stat" style="margin:0"><div class="ico" style="background:${bg}">${i}</div><div><small>${l}</small><b>${v}</b></div></div>`; }
const stuOptions = (sel, all) => (all ? `<option value="">${all}</option>` : '') + D.students.map(s => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.full_name)} (${esc(s.student_no || '—')})</option>`).join('');
async function run(promise, okMsg) { const {error} = await promise; if (error) { toast('Error: ' + error.message); return false; } toast(okMsg); await load(); render(); return true; }

const V = {
  dashboard() {
    const total = D.fees.reduce((a, f) => a + Number(f.amount), 0), col = okPays().reduce((a, p) => a + Number(p.amount), 0);
    const overdue = D.students.filter(s => studentTotals(s.id).overdue).length;
    return `<h1>Admin Dashboard</h1><p class="sub">Finance &amp; Reporting overview</p>
    <div class="grid g4">${stat('👥', '#e6edfb', 'Students', D.students.length)}${stat('💰', '#fff0cf', 'Total Assessment', peso(total))}${stat('✅', '#dff5ea', 'Collected', peso(col))}${stat('⚠️', '#fde2e5', 'Students Overdue', overdue)}</div>
    <div class="grid g2" style="margin-top:18px">
      <div class="card"><h3>Recent payments</h3>${payTable(okPays().slice(0, 6))}</div>
      <div class="card"><h3>Highest balances</h3><table><tr><th>Student</th><th>Balance</th></tr>${D.students.map(s => ({s, t: studentTotals(s.id)})).filter(x => x.t.bal > 0).sort((a, b) => b.t.bal - a.t.bal).slice(0, 6).map(x => `<tr><td>${esc(x.s.full_name)}</td><td>${peso(x.t.bal)} ${x.t.overdue ? '<span class="pill overdue">Overdue</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="2" class="empty">No balances</td></tr>'}</table></div>
    </div>`;
  },

  students() {
    const q = filt.q.toLowerCase(), list = D.students.filter(s => [s.full_name, s.student_no, s.email, s.course].join(' ').toLowerCase().includes(q));
    return `<h1>Students</h1><p class="sub">All registered students and their balances</p>
    <div class="card"><div class="toolbar"><div><label>Search</label><input value="${esc(filt.q)}" oninput="filt.q=this.value;render();this.focus();this.setSelectionRange(99,99)" placeholder="Name, student no., email…"></div></div>
    <table><tr><th>Student No.</th><th>Name</th><th>Course / Year</th><th>Email</th><th>Assessment</th><th>Paid</th><th>Balance</th><th></th></tr>
    ${list.map(s => { const t = studentTotals(s.id); return `<tr><td>${esc(s.student_no || '—')}</td><td>${esc(s.full_name)}</td><td>${esc(s.course || '')} ${esc(s.year_level || '')}</td><td>${esc(s.email)}</td><td>${peso(t.total)}</td><td>${peso(t.paid)}</td><td>${t.bal > 0 ? `<b style="color:var(--bad)">${peso(t.bal)}</b>` : '<span class="pill paid">Cleared</span>'}</td><td><button class="ghost sm" onclick="editStudent('${s.id}')">Edit</button></td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">No students found. Students appear here after they sign up.</td></tr>'}</table></div>`;
  },

  fees() {
    const list = D.fees.filter(f => !filt.student || f.student_id === filt.student);
    return `<h1>Manage Fees</h1><p class="sub">Assign Prelim / Midterm / Finals fees to students</p>
    <div class="card"><h3>Add fee</h3><form id="feeForm" class="toolbar">
      <div><label>Student</label><select id="fStu">${stuOptions('', '★ All students')}</select></div>
      <div><label>Term</label><select id="fTerm">${TERMS.map(t => `<option value="${t}">${TERM_NAME[t]}</option>`).join('')}</select></div>
      <div><label>Description</label><input id="fDesc" required maxlength="120" placeholder="e.g. Tuition fee"></div>
      <div><label>Amount (₱)</label><input id="fAmt" type="number" min="1" step="0.01" required></div>
      <div><label>Due date</label><input id="fDue" type="date" required></div>
      <button type="submit">Add fee</button></form></div>
    <div class="card"><div class="toolbar"><div><label>Filter by student</label><select onchange="filt.student=this.value;render()">${stuOptions(filt.student, 'All students')}</select></div></div>
    <table><tr><th>Student</th><th>Term</th><th>Description</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Due</th><th>Status</th><th></th></tr>
    ${list.map(f => { const i = feeInfo(f, D.payments); return `<tr><td>${esc(stu(f.student_id).full_name)}</td><td>${TERM_NAME[f.term]}</td><td>${esc(f.description)}</td><td>${peso(f.amount)}</td><td>${peso(i.paid)}</td><td>${peso(i.balance)}</td><td>${fmtDate(f.due_date)}</td><td><span class="pill ${i.status}">${LABEL[i.status]}</span></td><td><button class="ghost sm" onclick="editFee('${f.id}')">Edit</button> <button class="danger sm" onclick="delFee('${f.id}')">✕</button></td></tr>`; }).join('') || '<tr><td colspan="9" class="empty">No fees yet</td></tr>'}</table></div>`;
  },

  payments() {
    const open = D.fees.map(f => ({...f, ...feeInfo(f, D.payments)})).filter(f => f.balance > 0);
    return `<h1>Payments</h1><p class="sub">All transactions · record cashier (walk-in) payments</p>
    <div class="card"><h3>Record cashier payment</h3><form id="payForm" class="toolbar">
      <div style="flex:2"><label>Fee</label><select id="pFee">${open.map(f => `<option value="${f.id}">${esc(stu(f.student_id).full_name)} – ${TERM_NAME[f.term]} – ${esc(f.description)} (bal ${peso(f.balance)})</option>`).join('') || '<option value="">No unpaid fees</option>'}</select></div>
      <div><label>Amount (₱)</label><input id="pAmt" type="number" min="1" step="0.01" required></div>
      <button type="submit" ${open.length ? '' : 'disabled'}>Record</button></form></div>
    <div class="card"><h3>Transactions</h3>${payTable(D.payments, true)}</div>`;
  },

  financial() {
    const byTerm = TERMS.map(t => { const fs = D.fees.filter(f => f.term === t), a = fs.reduce((x, f) => x + Number(f.amount), 0), p = fs.reduce((x, f) => x + feeInfo(f, D.payments).paid, 0); return {t, a, p}; });
    const max = Math.max(1, ...byTerm.map(x => x.a)), methods = {};
    okPays().forEach(p => methods[p.method] = (methods[p.method] || 0) + Number(p.amount));
    const A = byTerm.reduce((x, y) => x + y.a, 0), P = byTerm.reduce((x, y) => x + y.p, 0);
    return `<div class="row"><div><h1>Financial Reports</h1><p class="sub">Collections and receivables · SY 2026-2027</p></div><div><button class="ghost" onclick="exportCSV()">⬇ Export CSV</button> <button class="ghost" onclick="print()">🖨 Print</button></div></div>
    <div class="grid g4">${stat('💰', '#e6edfb', 'Total Assessment', peso(A))}${stat('✅', '#dff5ea', 'Collected', peso(P))}${stat('📌', '#fde2e5', 'Receivables', peso(A - P))}${stat('📈', '#fff0cf', 'Collection Rate', (A ? Math.round(P / A * 100) : 0) + '%')}</div>
    <div class="grid g2" style="margin-top:18px">
      <div class="card"><h3>Assessment vs. Collected per term</h3><div class="chart">${byTerm.map(x => `<div class="col"><div class="pair"><div style="height:${x.a / max * 100}%;background:var(--blue)"></div><div style="height:${x.p / max * 100}%;background:var(--ok)"></div></div>${TERM_NAME[x.t]}</div>`).join('')}</div><p class="sub" style="margin:10px 0 0">🟦 Assessment &nbsp; 🟩 Collected</p></div>
      <div class="card"><h3>Collections by method</h3><table><tr><th>Method</th><th>Amount</th></tr>${Object.entries(methods).map(([m, v]) => `<tr><td>${esc(m)}</td><td>${peso(v)}</td></tr>`).join('') || '<tr><td colspan="2" class="empty">No collections yet</td></tr>'}</table></div>
    </div>
    <div class="card"><h3>Per-term summary</h3><table><tr><th>Term</th><th>Assessment</th><th>Collected</th><th>Receivable</th><th>Rate</th></tr>${byTerm.map(x => `<tr><td>${TERM_NAME[x.t]}</td><td>${peso(x.a)}</td><td>${peso(x.p)}</td><td>${peso(x.a - x.p)}</td><td>${x.a ? Math.round(x.p / x.a * 100) : 0}%</td></tr>`).join('')}</table></div>`;
  },

  academic() {
    const list = D.grades.filter(g => !filt.student || g.student_id === filt.student);
    const avg = g => { const v = [g.prelim, g.midterm, g.finals].filter(x => x != null).map(Number); return v.length ? v.reduce((a, b) => a + b) / v.length : null; };
    const done = D.grades.map(avg).filter(x => x != null), passed = done.filter(x => x >= 75).length;
    return `<div class="row"><div><h1>Academic Reports</h1><p class="sub">Encode and review student grades</p></div><button class="ghost" onclick="print()">🖨 Print</button></div>
    <div class="grid g4">${stat('📚', '#e6edfb', 'Grade records', D.grades.length)}${stat('⭐', '#dff5ea', 'Overall average', done.length ? (done.reduce((a, b) => a + b) / done.length).toFixed(2) : '—')}${stat('✅', '#dff5ea', 'Passed', passed)}${stat('❌', '#fde2e5', 'Failed', done.length - passed)}</div>
    <div class="card" style="margin-top:18px"><h3>Add grade</h3><form id="gradeForm" class="toolbar">
      <div><label>Student</label><select id="gStu" required>${stuOptions('')}</select></div>
      <div><label>Code</label><input id="gCode" required maxlength="20" placeholder="IT 301"></div>
      <div style="flex:2"><label>Subject</label><input id="gName" required maxlength="100"></div>
      <div><label>Units</label><input id="gUnits" type="number" min="1" max="6" value="3" required></div>
      <div><label>Prelim</label><input id="gP" type="number" min="0" max="100" step="0.01"></div>
      <div><label>Midterm</label><input id="gM" type="number" min="0" max="100" step="0.01"></div>
      <div><label>Finals</label><input id="gF" type="number" min="0" max="100" step="0.01"></div>
      <button type="submit">Add</button></form></div>
    <div class="card"><div class="toolbar"><div><label>Filter by student</label><select onchange="filt.student=this.value;render()">${stuOptions(filt.student, 'All students')}</select></div></div>
    <table><tr><th>Student</th><th>Code</th><th>Subject</th><th>Units</th><th>Prelim</th><th>Midterm</th><th>Finals</th><th>Average</th><th></th></tr>
    ${list.map(g => { const a = avg(g); return `<tr><td>${esc(stu(g.student_id).full_name)}</td><td>${esc(g.subject_code)}</td><td>${esc(g.subject_name)}</td><td>${g.units}</td><td>${g.prelim ?? '—'}</td><td>${g.midterm ?? '—'}</td><td>${g.finals ?? '—'}</td><td>${a == null ? '—' : `<span class="pill ${a >= 75 ? 'paid' : 'overdue'}">${a.toFixed(2)}</span>`}</td><td><button class="ghost sm" onclick="editGrade('${g.id}')">Edit</button> <button class="danger sm" onclick="delGrade('${g.id}')">✕</button></td></tr>`; }).join('') || '<tr><td colspan="9" class="empty">No grades yet</td></tr>'}</table></div>`;
  },

  notifications() {
    const withBal = D.students.filter(s => studentTotals(s.id).bal > 0).length;
    return `<h1>Notifications</h1><p class="sub">Send payment reminders and announcements to students</p>
    <div class="grid g2">
      <div class="card"><h3>⏰ Automatic balance reminders</h3><p class="sub">Sends each student with an unpaid Prelim / Midterm / Finals balance a personal reminder with their exact amount.</p>
        <p><b>${withBal}</b> student(s) currently have a balance.</p><button style="margin-top:12px" ${withBal ? '' : 'disabled'} onclick="sendReminders()">Send reminders now</button></div>
      <div class="card"><h3>📢 Custom message</h3><form id="notifForm">
        <label>To</label><select id="nTo">${stuOptions('', '★ All students')}</select>
        <label>Type</label><select id="nType"><option value="info">Announcement</option><option value="reminder">Reminder</option><option value="overdue">Overdue warning</option></select>
        <label>Title</label><input id="nTitle" required maxlength="120">
        <label>Message</label><textarea id="nMsg" required maxlength="1000"></textarea>
        <button type="submit" style="margin-top:12px">Send</button></form></div>
    </div>
    <div class="card"><h3>Sent notifications</h3><table><tr><th>Date</th><th>Student</th><th>Title</th><th>Type</th><th>Read</th><th></th></tr>
    ${D.notifs.map(n => `<tr><td>${fmtDate(n.created_at)}</td><td>${esc(stu(n.student_id).full_name)}</td><td>${esc(n.title)}</td><td>${n.type}</td><td>${n.is_read ? '✔' : '—'}</td><td><button class="danger sm" onclick="delNotif('${n.id}')">✕</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">None sent yet</td></tr>'}</table></div>`;
  }
};

function payTable(list, actions) {
  if (!list.length) return '<p class="empty">No payments yet.</p>';
  return `<table><tr><th>Date</th><th>Reference</th><th>Student</th><th>Term</th><th>Method</th><th>Amount</th>${actions ? '<th>Status</th><th></th>' : ''}</tr>
  ${list.map(p => { const f = D.fees.find(x => x.id === p.fee_id) || {}; return `<tr><td>${fmtDate(p.created_at)}</td><td>${esc(p.reference)}</td><td>${esc(stu(p.student_id).full_name)}</td><td>${TERM_NAME[f.term] || '—'}</td><td>${esc(p.method)}</td><td>${peso(p.amount)}</td>${actions ? `<td><span class="pill ${p.status === 'success' ? 'paid' : 'overdue'}">${p.status}</span></td><td>${p.status === 'success' ? `<button class="danger sm" onclick="voidPay('${p.id}')">Void</button>` : ''}</td>` : ''}</tr>`; }).join('')}</table>`;
}

// ---------- actions ----------
function bindForms() {
  const on = (id, fn) => { const f = $(id); if (f) f.onsubmit = e => { e.preventDefault(); fn(); }; };
  on('#feeForm', async () => {
    const ids = $('#fStu').value ? [$('#fStu').value] : D.students.map(s => s.id);
    if (!ids.length) return toast('No students yet');
    const rows = ids.map(id => ({student_id: id, term: $('#fTerm').value, description: $('#fDesc').value.trim(), amount: Number($('#fAmt').value), due_date: $('#fDue').value}));
    run(sb.from('fees').insert(rows), `Fee added to ${ids.length} student(s)`);
  });
  on('#payForm', async () => {
    const f = D.fees.find(x => x.id === $('#pFee').value), bal = feeInfo(f, D.payments).balance, amt = Number($('#pAmt').value);
    if (!(amt > 0) || amt > bal) return toast(`Amount must be between ₱1 and ${peso(bal)}`);
    const ref = 'FBC-CSH-' + Date.now().toString(36).toUpperCase();
    run(sb.from('payments').insert({student_id: f.student_id, fee_id: f.id, amount: amt, method: 'Cash (Cashier)', reference: ref}), 'Payment recorded');
  });
  on('#gradeForm', () => {
    const n = id => $(id).value === '' ? null : Number($(id).value);
    run(sb.from('grades').insert({student_id: $('#gStu').value, subject_code: $('#gCode').value.trim(), subject_name: $('#gName').value.trim(), units: Number($('#gUnits').value), prelim: n('#gP'), midterm: n('#gM'), finals: n('#gF')}), 'Grade added');
  });
  on('#notifForm', () => {
    const ids = $('#nTo').value ? [$('#nTo').value] : D.students.map(s => s.id);
    run(sb.from('notifications').insert(ids.map(id => ({student_id: id, type: $('#nType').value, title: $('#nTitle').value.trim(), message: $('#nMsg').value.trim()}))), `Sent to ${ids.length} student(s)`);
  });
}

async function sendReminders() {
  const rows = [];
  D.students.forEach(s => {
    const lines = TERMS.map(t => { const fs = D.fees.filter(f => f.student_id === s.id && f.term === t); const b = fs.reduce((a, f) => a + feeInfo(f, D.payments).balance, 0); const od = fs.some(f => feeInfo(f, D.payments).status === 'overdue'); return b > 0 ? {t, b, od, due: fs.map(f => f.due_date).sort()[0]} : null; }).filter(Boolean);
    if (!lines.length) return;
    const od = lines.some(l => l.od);
    rows.push({student_id: s.id, type: od ? 'overdue' : 'reminder', title: od ? 'Overdue balance – please settle immediately' : 'Payment reminder',
      message: `Hi ${s.full_name}, you have an outstanding balance: ` + lines.map(l => `${TERM_NAME[l.t]} ${peso(l.b)} (due ${fmtDate(l.due)})${l.od ? ' – OVERDUE' : ''}`).join('; ') + '. You can pay online via the Payment page.'});
  });
  run(sb.from('notifications').insert(rows), `Reminders sent to ${rows.length} student(s)`);
}

function editStudent(id) {
  const s = stu(id);
  openModal(`<h3>Edit student</h3><label>Full name</label><input id="eN" value="${esc(s.full_name)}"><label>Student no.</label><input id="eNo" value="${esc(s.student_no || '')}">
  <label>Course</label><input id="eC" value="${esc(s.course || '')}"><label>Year level</label><input id="eY" value="${esc(s.year_level || '')}">
  <div class="row" style="margin-top:16px"><button class="ghost" onclick="closeModal()">Cancel</button><button onclick="saveStudent('${id}')">Save</button></div>`, true);
}
async function saveStudent(id) { if (await run(sb.from('profiles').update({full_name: $('#eN').value.trim(), student_no: $('#eNo').value.trim(), course: $('#eC').value.trim(), year_level: $('#eY').value.trim()}).eq('id', id), 'Student updated')) closeModal(); }

function editFee(id) {
  const f = D.fees.find(x => x.id === id);
  openModal(`<h3>Edit fee</h3><label>Description</label><input id="eD" value="${esc(f.description)}"><label>Amount</label><input id="eA" type="number" step="0.01" value="${f.amount}"><label>Due date</label><input id="eDue" type="date" value="${f.due_date}">
  <div class="row" style="margin-top:16px"><button class="ghost" onclick="closeModal()">Cancel</button><button onclick="saveFee('${id}')">Save</button></div>`, true);
}
async function saveFee(id) { if (await run(sb.from('fees').update({description: $('#eD').value.trim(), amount: Number($('#eA').value), due_date: $('#eDue').value}).eq('id', id), 'Fee updated')) closeModal(); }
function delFee(id) { if (confirm('Delete this fee and its payments?')) run(sb.from('fees').delete().eq('id', id), 'Fee deleted'); }
function voidPay(id) { if (confirm('Void this payment? The balance will return to the student.')) run(sb.from('payments').update({status: 'failed'}).eq('id', id), 'Payment voided'); }

function editGrade(id) {
  const g = D.grades.find(x => x.id === id);
  openModal(`<h3>Edit grade – ${esc(g.subject_code)}</h3><label>Prelim</label><input id="eP" type="number" value="${g.prelim ?? ''}"><label>Midterm</label><input id="eM" type="number" value="${g.midterm ?? ''}"><label>Finals</label><input id="eF" type="number" value="${g.finals ?? ''}">
  <div class="row" style="margin-top:16px"><button class="ghost" onclick="closeModal()">Cancel</button><button onclick="saveGrade('${id}')">Save</button></div>`, true);
}
async function saveGrade(id) { const n = s => $(s).value === '' ? null : Number($(s).value); if (await run(sb.from('grades').update({prelim: n('#eP'), midterm: n('#eM'), finals: n('#eF')}).eq('id', id), 'Grade updated')) closeModal(); }
function delGrade(id) { if (confirm('Delete this grade?')) run(sb.from('grades').delete().eq('id', id), 'Grade deleted'); }
function delNotif(id) { run(sb.from('notifications').delete().eq('id', id), 'Notification deleted'); }

function exportCSV() {
  const rows = [['Date', 'Reference', 'Student No', 'Student', 'Term', 'Description', 'Method', 'Amount', 'Status']];
  D.payments.forEach(p => { const f = D.fees.find(x => x.id === p.fee_id) || {}, s = stu(p.student_id); rows.push([p.created_at.slice(0, 10), p.reference, s.student_no || '', s.full_name, TERM_NAME[f.term] || '', f.description || '', p.method, p.amount, p.status]); });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], {type: 'text/csv'}));
  a.download = 'financial-report.csv'; a.click();
}

const CRUMB = {dashboard: 'Dashboard', students: 'Students', fees: 'Fees', payments: 'Payments', financial: 'Financial Reports', academic: 'Academic Reports', notifications: 'Notifications'};
function render() { $('#view').innerHTML = V[current](); $('#crumb').textContent = '› ' + CRUMB[current]; bindForms(); }
function nav(v) { current = v; filt.student = ''; document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.dataset.view === v)); render(); }
document.querySelectorAll('#nav a').forEach(a => a.onclick = () => nav(a.dataset.view));
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };

(async () => {
  ME = await requireRole('admin'); if (!ME) return;
  $('#who').textContent = `🛡 ${ME.profile.full_name || ME.user.email} · Administrator`;
  await load(); render();
})();

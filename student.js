let ME, D = {fees: [], payments: [], grades: [], notifs: []}, current = 'fees', payFeeId = null;

async function load() {
  const id = ME.user.id;
  const [f, p, g, n] = await Promise.all([
    sb.from('fees').select('*').eq('student_id', id).order('due_date'),
    sb.from('payments').select('*').eq('student_id', id).order('created_at', {ascending: false}),
    sb.from('grades').select('*').eq('student_id', id).order('subject_code'),
    sb.from('notifications').select('*').eq('student_id', id).order('created_at', {ascending: false})
  ]);
  D = {fees: f.data || [], payments: p.data || [], grades: g.data || [], notifs: n.data || []};
}

// fees grouped per term
function termSummary() {
  return TERMS.map(t => {
    const items = D.fees.filter(f => f.term === t).map(f => ({...f, ...feeInfo(f, D.payments)}));
    const total = items.reduce((a, i) => a + Number(i.amount), 0), paid = items.reduce((a, i) => a + i.paid, 0);
    const bal = total - paid, due = items.map(i => i.due_date).sort()[0];
    let status = !items.length ? 'none' : bal <= 0 ? 'paid' : items.some(i => i.status === 'overdue') ? 'overdue' : paid > 0 ? 'partial' : 'unpaid';
    return {term: t, items, total, paid, bal, due, status};
  });
}

// auto reminders computed from balances + stored notifications
function allNotifs() {
  const auto = [];
  D.fees.forEach(f => {
    const i = feeInfo(f, D.payments); if (i.status === 'paid') return;
    if (i.status === 'overdue') auto.push({auto: true, type: 'overdue', icon: '⚠️', title: `${TERM_NAME[f.term]} balance is overdue`, message: `You still owe ${peso(i.balance)} for "${f.description}". It was due on ${fmtDate(f.due_date)}. Please settle it to avoid exam permit issues.`, fee: f.id});
    else if (i.days <= 14) auto.push({auto: true, type: 'reminder', icon: '⏰', title: `${TERM_NAME[f.term]} payment due in ${i.days} day${i.days === 1 ? '' : 's'}`, message: `Remaining balance: ${peso(i.balance)} for "${f.description}". Due ${fmtDate(f.due_date)}.`, fee: f.id});
  });
  const icon = {info: '📢', reminder: '⏰', overdue: '⚠️', paid: '✅'};
  return [...auto, ...D.notifs.map(n => ({...n, icon: icon[n.type]}))];
}
function badge() { const c = allNotifs().filter(n => n.auto || !n.is_read).length; $('#badge').textContent = c || ''; }

const V = {
  fees() {
    const T = termSummary(), total = T.reduce((a, t) => a + t.total, 0), paid = T.reduce((a, t) => a + t.paid, 0);
    return `<h1>Student Balance Fees</h1><p class="sub">School Year 2026-2027 · ${esc(ME.profile.student_no || '')}</p>
    <div class="grid g4">
      ${stat('💰', '#e6edfb', 'Total Assessment', peso(total))}
      ${stat('✅', '#dff5ea', 'Total Paid', peso(paid))}
      ${stat('📌', '#fde2e5', 'Remaining Balance', peso(total - paid))}
      ${stat('📈', '#fff0cf', 'Progress', (total ? Math.round(paid / total * 100) : 0) + '%')}
    </div>
    <div class="card" style="margin-top:18px"><div class="bar"><i style="width:${total ? paid / total * 100 : 0}%"></i></div></div>
    ${!D.fees.length ? '<div class="card empty">No fees have been assigned to your account yet. Please check back later or visit the cashier.</div>' : ''}
    <div class="grid g3">${T.filter(t => t.items.length).map(t => `
      <div class="card term ${t.status}">
        <div class="row"><h3>${TERM_NAME[t.term]}</h3><span class="pill ${t.status}">${LABEL[t.status]}</span></div>
        <small class="sub">Due ${fmtDate(t.due)}</small>
        <div class="amt">${peso(t.bal)}</div>
        <table>${t.items.map(i => `<tr><td>${esc(i.description)}</td><td style="text-align:right">${peso(i.amount)}</td></tr>`).join('')}
        <tr><td><b>Paid</b></td><td style="text-align:right;color:var(--ok)"><b>-${peso(t.paid)}</b></td></tr></table>
        <button style="margin-top:12px;width:100%" ${t.bal <= 0 ? 'disabled' : ''} onclick="goPay('${t.items.find(i => i.balance > 0)?.id || ''}')">${t.bal <= 0 ? 'Fully paid' : 'Pay now'}</button>
      </div>`).join('')}</div>`;
  },

  payment() {
    const open = D.fees.map(f => ({...f, ...feeInfo(f, D.payments)})).filter(f => f.balance > 0);
    if (!open.length) return `<h1>Payment</h1><p class="sub">Online payment gateway</p><div class="card empty">🎉 You have no outstanding balance.</div>`;
    const sel = open.find(f => f.id === payFeeId) || open[0];
    return `<h1>Payment</h1><p class="sub">Pay your school fees online</p>
    <div class="grid g2">
      <div class="card"><h3>Payment details</h3>
        <label>Fee to pay</label><select id="pFee" onchange="payFeeId=this.value;render()">
          ${open.map(f => `<option value="${f.id}" ${f.id === sel.id ? 'selected' : ''}>${TERM_NAME[f.term]} – ${esc(f.description)} (${peso(f.balance)})</option>`).join('')}</select>
        <label>Amount (₱)</label><input id="pAmt" type="number" min="1" step="0.01" max="${sel.balance}" value="${sel.balance}">
        <label>Payment method</label>
        <div class="methods">${[['gcash', '📱', 'GCash'], ['maya', '💚', 'Maya'], ['card', '💳', 'Card'], ['bank', '🏦', 'Bank']].map((m, i) => `<div class="method ${i ? '' : 'sel'}" data-m="${m[2]}" onclick="document.querySelectorAll('.method').forEach(x=>x.classList.remove('sel'));this.classList.add('sel');methodFields()"><span>${m[1]}</span>${m[2]}</div>`).join('')}</div>
        <div id="mFields"></div>
        <button style="width:100%;margin-top:16px" onclick="pay()">Proceed to pay</button>
        <div class="gw">🔒 Secured by FBC Pay Gateway (demo). No real money will be charged.</div>
      </div>
      <div class="card"><h3>Summary</h3>
        <div class="receipt">
          <div><span>Student</span><b>${esc(ME.profile.full_name)}</b></div>
          <div><span>Student No.</span><b>${esc(ME.profile.student_no || '—')}</b></div>
          <div><span>Term</span><b>${TERM_NAME[sel.term]}</b></div>
          <div><span>Description</span><b>${esc(sel.description)}</b></div>
          <div><span>Total fee</span><b>${peso(sel.amount)}</b></div>
          <div><span>Already paid</span><b>${peso(sel.paid)}</b></div>
          <div><span>Balance</span><b style="color:var(--bad)">${peso(sel.balance)}</b></div>
          <div><span>Due date</span><b>${fmtDate(sel.due_date)}</b></div>
        </div></div>
    </div>`;
  },

  financial() {
    const ok = D.payments.filter(p => p.status === 'success'), T = termSummary();
    const fee = id => D.fees.find(f => f.id === id) || {};
    const max = Math.max(1, ...T.map(t => t.total));
    return `<div class="row"><div><h1>Financial Report</h1><p class="sub">Statement of account & payment history</p></div><button class="ghost" onclick="print()">🖨 Print</button></div>
    <div class="card"><h3>Assessment vs. Paid per term</h3>
      <div class="chart">${T.map(t => `<div class="col"><div class="pair"><div style="height:${t.total / max * 100}%;background:var(--blue)" title="${peso(t.total)}"></div><div style="height:${t.paid / max * 100}%;background:var(--ok)" title="${peso(t.paid)}"></div></div>${TERM_NAME[t.term]}</div>`).join('')}</div>
      <p class="sub" style="margin:10px 0 0">🟦 Assessment &nbsp; 🟩 Paid</p></div>
    <div class="card"><h3>Statement per term</h3><table><tr><th>Term</th><th>Assessment</th><th>Paid</th><th>Balance</th><th>Status</th></tr>
      ${T.map(t => `<tr><td>${TERM_NAME[t.term]}</td><td>${peso(t.total)}</td><td>${peso(t.paid)}</td><td>${peso(t.bal)}</td><td>${t.status === 'none' ? '—' : `<span class="pill ${t.status}">${LABEL[t.status]}</span>`}</td></tr>`).join('')}</table></div>
    <div class="card"><h3>Transaction history</h3>${!ok.length ? '<p class="empty">No payments yet.</p>' : `<table><tr><th>Date</th><th>Reference</th><th>Term</th><th>Method</th><th>Amount</th><th></th></tr>
      ${ok.map(p => `<tr><td>${fmtDate(p.created_at)}</td><td>${esc(p.reference)}</td><td>${TERM_NAME[fee(p.fee_id).term] || '—'}</td><td>${esc(p.method)}</td><td>${peso(p.amount)}</td><td><button class="ghost sm" onclick="receipt('${p.id}')">Receipt</button></td></tr>`).join('')}</table>`}</div>`;
  },

  academic() {
    const rows = D.grades.map(g => { const v = [g.prelim, g.midterm, g.finals].filter(x => x != null).map(Number); return {...g, avg: v.length ? v.reduce((a, b) => a + b) / v.length : null}; });
    const done = rows.filter(r => r.avg != null), units = done.reduce((a, r) => a + r.units, 0);
    const gwa = units ? done.reduce((a, r) => a + r.avg * r.units, 0) / units : 0;
    const eq = a => a >= 97 ? '1.00' : a >= 94 ? '1.25' : a >= 91 ? '1.50' : a >= 88 ? '1.75' : a >= 85 ? '2.00' : a >= 82 ? '2.25' : a >= 79 ? '2.50' : a >= 76 ? '2.75' : a >= 75 ? '3.00' : '5.00';
    return `<div class="row"><div><h1>Academic Report</h1><p class="sub">${esc(ME.profile.course || '')} · ${esc(ME.profile.year_level || '')} · SY 2026-2027</p></div><button class="ghost" onclick="print()">🖨 Print</button></div>
    <div class="grid g4">${stat('📚', '#e6edfb', 'Subjects', rows.length)}${stat('🧮', '#fff0cf', 'Units', rows.reduce((a, r) => a + r.units, 0))}${stat('⭐', '#dff5ea', 'GWA', units ? gwa.toFixed(2) : '—')}${stat('🎯', '#fde2e5', 'Equivalent', units ? eq(gwa) : '—')}</div>
    <div class="card" style="margin-top:18px"><h3>Grades</h3>${!rows.length ? '<p class="empty">No grades posted yet.</p>' : `<table><tr><th>Code</th><th>Subject</th><th>Units</th><th>Prelim</th><th>Midterm</th><th>Finals</th><th>Average</th><th>Remarks</th></tr>
      ${rows.map(r => `<tr><td>${esc(r.subject_code)}</td><td>${esc(r.subject_name)}</td><td>${r.units}</td><td>${r.prelim ?? '—'}</td><td>${r.midterm ?? '—'}</td><td>${r.finals ?? '—'}</td><td><b>${r.avg != null ? r.avg.toFixed(2) : '—'}</b></td><td>${r.avg == null ? '—' : `<span class="pill ${r.avg >= 75 ? 'paid' : 'overdue'}">${r.avg >= 75 ? 'Passed' : 'Failed'}</span>`}</td></tr>`).join('')}</table>`}</div>`;
  },

  notifications() {
    const list = allNotifs();
    return `<div class="row"><div><h1>Notifications</h1><p class="sub">Payment reminders and announcements</p></div>${D.notifs.some(n => !n.is_read) ? '<button class="ghost" onclick="markAll()">Mark all as read</button>' : ''}</div>
    ${!list.length ? '<div class="card empty">No notifications. You are all caught up! 🎉</div>' : list.map(n => `
      <div class="notif ${n.type === 'reminder' ? 'soon' : n.type}" style="${!n.auto && n.is_read ? 'opacity:.65' : ''}">
        <div style="font-size:22px">${n.icon}</div>
        <div style="flex:1"><div class="row"><b>${esc(n.title)}</b><small class="sub" style="margin:0">${n.auto ? 'Auto reminder' : fmtDate(n.created_at)}</small></div>
        <p style="font-size:14px;margin-top:4px">${esc(n.message)}</p>
        ${n.auto ? `<button class="sm" style="margin-top:8px" onclick="goPay('${n.fee}')">Pay now</button>` : ''}</div>
      </div>`).join('')}`;
  }
};

function stat(i, bg, l, v) { return `<div class="card stat" style="margin:0"><div class="ico" style="background:${bg}">${i}</div><div><small>${l}</small><b>${v}</b></div></div>`; }
function methodFields() {
  const m = document.querySelector('.method.sel').dataset.m;
  $('#mFields').innerHTML = m === 'Card'
    ? `<label>Card number</label><input id="mf1" maxlength="19" placeholder="4111 1111 1111 1111"><div class="grid g2" style="gap:10px"><div><label>Expiry</label><input id="mf2" placeholder="MM/YY" maxlength="5"></div><div><label>CVV</label><input id="mf3" maxlength="4" placeholder="123"></div></div>`
    : m === 'Bank' ? `<label>Bank</label><select id="mf1"><option>BDO</option><option>BPI</option><option>Landbank</option><option>Metrobank</option></select><label>Account name</label><input id="mf2" value="${esc(ME.profile.full_name)}">`
    : `<label>${m} mobile number</label><input id="mf1" maxlength="11" placeholder="09XXXXXXXXX">`;
}
function goPay(id) { payFeeId = id; nav('payment'); }

async function pay() {
  const fee = D.fees.find(f => f.id === $('#pFee').value), info = feeInfo(fee, D.payments);
  const amt = Math.round(Number($('#pAmt').value) * 100) / 100, method = document.querySelector('.method.sel').dataset.m;
  const v1 = ($('#mf1')?.value || '').replace(/\s/g, '');
  if (!(amt > 0) || amt > info.balance) return toast(`Enter an amount between ₱1 and ${peso(info.balance)}`);
  if ((method === 'GCash' || method === 'Maya') && !/^09\d{9}$/.test(v1)) return toast('Enter a valid 11-digit mobile number (09XXXXXXXXX)');
  if (method === 'Card' && (!/^\d{13,16}$/.test(v1) || !/^\d{2}\/\d{2}$/.test($('#mf2').value) || !/^\d{3,4}$/.test($('#mf3').value))) return toast('Enter valid card details');

  openModal(`<h3>Connecting to ${method}…</h3><div class="spin"></div><p class="sub">Please don't close this window</p>`);
  await new Promise(r => setTimeout(r, 1200));
  openModal(`<h3>Authorizing ${peso(amt)}…</h3><div class="spin"></div><p class="sub">Verifying with FBC Pay Gateway</p>`);
  await new Promise(r => setTimeout(r, 1300));

  const ref = 'FBC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const {data, error} = await sb.from('payments').insert({student_id: ME.user.id, fee_id: fee.id, amount: amt, method, reference: ref, status: 'success'}).select().single();
  if (error) return openModal(`<h3>Payment failed</h3><p class="sub">${esc(error.message)}</p><button onclick="closeModal()">Close</button>`);
  await load(); badge(); render();
  receipt(data.id, true);
}

function receipt(id, fresh) {
  const p = D.payments.find(x => x.id === id), f = D.fees.find(x => x.id === p.fee_id) || {};
  openModal(`${fresh ? '<div class="check">✓</div><h3>Payment successful!</h3>' : '<h3>Official Receipt</h3>'}
    <div class="receipt">
      <div><span>Reference no.</span><b>${esc(p.reference)}</b></div>
      <div><span>Date</span><b>${new Date(p.created_at).toLocaleString('en-PH')}</b></div>
      <div><span>Student</span><b>${esc(ME.profile.full_name)}</b></div>
      <div><span>Term</span><b>${TERM_NAME[f.term] || '—'}</b></div>
      <div><span>For</span><b>${esc(f.description || '—')}</b></div>
      <div><span>Method</span><b>${esc(p.method)}</b></div>
      <div><span>Amount paid</span><b style="color:var(--ok)">${peso(p.amount)}</b></div>
    </div><div class="row"><button class="ghost" onclick="print()">🖨 Print</button><button onclick="closeModal()">Done</button></div>`);
}

async function markAll() {
  await sb.from('notifications').update({is_read: true}).eq('student_id', ME.user.id).eq('is_read', false);
  await load(); badge(); render();
}

const CRUMB = {fees: 'Fees', payment: 'Payment', financial: 'Financial Reports', academic: 'Academic Reports', notifications: 'Notifications'};
function render() {
  $('#view').innerHTML = V[current]();
  $('#crumb').textContent = '› ' + CRUMB[current];
  if (current === 'payment' && $('#mFields')) methodFields();
}
async function nav(v) {
  current = v;
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.dataset.view === v));
  render();
  if (v === 'notifications' && D.notifs.some(n => !n.is_read)) {   // opening marks as read
    await sb.from('notifications').update({is_read: true}).eq('student_id', ME.user.id).eq('is_read', false);
    await load(); badge();
  }
}
document.querySelectorAll('#nav a').forEach(a => a.onclick = () => nav(a.dataset.view));
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };

(async () => {
  ME = await requireRole('student'); if (!ME) return;
  $('#who').textContent = `👤 ${ME.profile.full_name} · ${ME.profile.course || ''} ${ME.profile.year_level || ''}`;
  await load(); badge(); render();
})();

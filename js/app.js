/* app.js — APG Korea 업무대시보드 메인 로직 */

const DAYS_KO = ['월', '화', '수', '목', '금'];
const DATE_DAYS = ['2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10', '2026-04-11'];
const STATUS_KO = { done: '완료', wip: '진행중', todo: '예정' };

const LEAVE_TYPE_COLORS = {
  '연차': { bg: 'rgba(116,185,255,0.2)', text: '#74B9FF', icon: '📘' },
  '반차(오전)': { bg: 'rgba(129,236,236,0.2)', text: '#81ecec', icon: '🌅' },
  '반차(오후)': { bg: 'rgba(129,236,236,0.2)', text: '#81ecec', icon: '🌇' },
  '특휴': { bg: 'rgba(162,155,254,0.2)', text: '#a29bfe', icon: '⭐' },
  '병가': { bg: 'rgba(225,112,85,0.2)', text: '#E17055', icon: '🏥' },
};

const STATUS_LABEL = {
  confirmed: '확정', pending: '대기', cancelled: '취소',
  approved: '승인', rejected: '반려'
};

let allData = null;
let scheduleData = null;
let currentPeriod = 'this-week';
let currentView = 'work';

/* ── INIT ── */
async function init() {
  setHeaderDate();
  try {
    const [reportsRes, schedulesRes] = await Promise.all([
      fetch('./data/reports.json'),
      fetch('./data/schedules.json'),
    ]);
    if (!reportsRes.ok) throw new Error('reports fetch failed');
    allData = await reportsRes.json();
    if (schedulesRes.ok) {
      scheduleData = await schedulesRes.json();
    }
    render();
    renderSchedules();
  } catch(e) {
    console.error(e);
    document.getElementById('app').innerHTML = `
      <div class="loading">
        <div style="color:#E17055;font-size:16px;">⚠️ 데이터를 불러올 수 없습니다.</div>
        <div style="color:#8888aa;font-size:13px;">data/reports.json 파일을 확인하세요.</div>
      </div>`;
  }
}

function setHeaderDate() {
  const now = new Date();
  const opts = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  document.getElementById('currentDate').textContent =
    now.toLocaleDateString('ko-KR', opts);
}

/* ── PERIOD FILTER ── */
function getFilteredReports() {
  if (!allData) return [];
  const now = new Date();
  const reports = allData.reports;

  if (currentPeriod === 'this-week') {
    const mon = getMonday(now);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return reports.filter(r => {
      const d = new Date(r.date);
      return d >= mon && d <= sun;
    });
  }
  if (currentPeriod === 'last-week') {
    const mon = getMonday(now);
    const lastMon = new Date(mon); lastMon.setDate(mon.getDate() - 7);
    const lastSun = new Date(mon); lastSun.setDate(mon.getDate() - 1);
    return reports.filter(r => {
      const d = new Date(r.date);
      return d >= lastMon && d <= lastSun;
    });
  }
  if (currentPeriod === 'this-month') {
    return reports.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }
  return reports;
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0,0,0,0);
  return date;
}

/* ── RENDER ── */
function render() {
  const reports = getFilteredReports();
  renderStats(reports);
  renderCharts(reports);
  renderMemberCards(reports);
  renderIssues(reports);
  renderMissing(reports);
}

/* ── STATS ── */
function renderStats(reports) {
  const totalHours = reports.reduce((s, r) => s + (r.totalHours || 0), 0);
  const totalTasks = reports.reduce((s, r) => s + r.items.length, 0);
  const doneTasks = reports.reduce((s, r) => s + r.items.filter(i => i.status === 'done').length, 0);
  const totalIssues = reports.reduce((s, r) => s + (r.issues || []).length, 0);
  const submitters = new Set(reports.map(r => r.memberId)).size;

  document.getElementById('stat-hours').textContent = totalHours.toFixed(1);
  document.getElementById('stat-tasks').textContent = totalTasks;
  document.getElementById('stat-done').textContent = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) + '%' : '0%';
  document.getElementById('stat-issues').textContent = totalIssues;
  document.getElementById('stat-submitters').textContent = `${submitters}명 제출`;
}

/* ── CHARTS ── */
function renderCharts(reports) {
  // 1. 팀원별 업무시간
  const memberMap = {};
  const colorMap = {};
  allData.team.forEach(m => { colorMap[m.name] = m.color; });

  reports.forEach(r => {
    if (!memberMap[r.member]) memberMap[r.member] = 0;
    memberMap[r.member] += r.totalHours || 0;
  });
  const memberNames = Object.keys(memberMap);
  renderMemberHoursChart({
    labels: memberNames,
    values: memberNames.map(n => memberMap[n]),
    colors: memberNames.map(n => colorMap[n] || '#888'),
  });

  // 2. 카테고리 분포
  const catMap = {};
  reports.forEach(r => r.items.forEach(i => {
    catMap[i.category] = (catMap[i.category] || 0) + i.hours;
  }));
  renderCategoryChart({
    labels: Object.keys(catMap),
    values: Object.values(catMap),
  });

  // 3. 상태 분포
  const statusMap = { done: 0, wip: 0, todo: 0 };
  reports.forEach(r => r.items.forEach(i => { statusMap[i.status] = (statusMap[i.status] || 0) + 1; }));
  renderStatusChart({
    labels: ['완료', '진행중', '예정'],
    values: [statusMap.done, statusMap.wip, statusMap.todo],
  });

  // 4. 주간 추이 (최근 4주)
  const weekLabels = [];
  const weekDatasets = [];
  const now = new Date();

  allData.team.forEach(member => {
    const ds = {
      label: member.name,
      borderColor: member.color,
      backgroundColor: member.color + '33',
      data: [],
    };
    for (let w = 3; w >= 0; w--) {
      const mon = getMonday(now);
      mon.setDate(mon.getDate() - w * 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const weekHours = allData.reports
        .filter(r => r.memberId === member.id)
        .filter(r => { const d = new Date(r.date); return d >= mon && d <= sun; })
        .reduce((s, r) => s + (r.totalHours || 0), 0);
      ds.data.push(weekHours);
      if (member === allData.team[0]) {
        weekLabels.push(`${w === 0 ? '이번주' : w === 1 ? '저번주' : w + '주전'}`);
      }
    }
    weekDatasets.push(ds);
  });

  renderWeeklyTrendChart({ labels: weekLabels, datasets: weekDatasets });
}

/* ── MEMBER CARDS ── */
function renderMemberCards(reports) {
  const container = document.getElementById('memberCards');
  container.innerHTML = '';

  allData.team.forEach(member => {
    const memberReports = reports.filter(r => r.memberId === member.id);
    if (memberReports.length === 0) return;

    const totalHours = memberReports.reduce((s, r) => s + (r.totalHours || 0), 0);
    const allItems = memberReports.flatMap(r => r.items);

    // Timeline: hours per day
    const dayHours = {};
    memberReports.forEach(r => {
      const d = new Date(r.date);
      const dayIdx = d.getDay() - 1; // 0=Mon
      if (dayIdx >= 0 && dayIdx <= 4) {
        dayHours[dayIdx] = (dayHours[dayIdx] || 0) + (r.totalHours || 0);
      }
    });
    const maxDay = Math.max(...Object.values(dayHours), 1);

    const card = document.createElement('div');
    card.className = 'member-card';
    card.innerHTML = `
      <div class="member-header">
        <div class="member-avatar" style="background:${member.color}">
          ${member.name[0]}
        </div>
        <div class="member-info">
          <h3>${member.name}</h3>
          <div class="role">${member.role}</div>
        </div>
        <div class="member-hours">
          <div class="hours-val" style="color:${member.color}">${totalHours.toFixed(1)}</div>
          <div class="hours-label">시간</div>
        </div>
      </div>
      <div class="timeline">
        <div class="timeline-title">일별 업무시간</div>
        <div class="timeline-days">
          ${DAYS_KO.map((d, i) => `
            <div class="day-slot">
              <div class="day-label">${d}</div>
              <div class="day-bar-wrap">
                <div class="day-bar" style="
                  height:${Math.round((dayHours[i] || 0) / maxDay * 100)}%;
                  background:${member.color}99;
                "></div>
              </div>
              <div class="day-hours-label">${dayHours[i] ? dayHours[i].toFixed(1) : '-'}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="task-list">
        ${allItems.slice(0, 5).map(item => `
          <div class="task-item">
            <div class="task-check ${item.status}">
              ${item.status === 'done' ? '✓' : item.status === 'wip' ? '◐' : ''}
            </div>
            <div class="task-name ${item.status === 'done' ? 'done' : ''}">${item.task}</div>
            <div class="task-meta">
              <span class="category-badge cat-${item.category}">${item.category}</span>
              <span class="task-hours">${item.hours}h</span>
            </div>
          </div>
        `).join('')}
        ${allItems.length > 5 ? `<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:6px;">+${allItems.length - 5}개 더</div>` : ''}
      </div>
    `;
    container.appendChild(card);
  });

  if (container.children.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px;">해당 기간 데이터 없음</div>';
  }
}

/* ── ISSUES ── */
function renderIssues(reports) {
  const container = document.getElementById('issueList');
  container.innerHTML = '';

  const colorMap = {};
  allData.team.forEach(m => { colorMap[m.name] = m.color; });

  const issues = reports.flatMap(r =>
    (r.issues || []).map(issue => ({ issue, member: r.member, date: r.date, color: colorMap[r.member] || '#888' }))
  );

  if (issues.length === 0) {
    container.innerHTML = '<div class="no-issues">✅ 이슈 없음</div>';
    return;
  }

  issues.forEach(({ issue, member, date, color }) => {
    const el = document.createElement('div');
    el.className = 'issue-item';
    el.innerHTML = `
      <div class="issue-icon">⚠️</div>
      <div style="flex:1">
        <div class="issue-text">${issue}</div>
        <div class="issue-date">${date}</div>
      </div>
      <span class="issue-member-tag" style="background:${color}">${member}</span>
    `;
    container.appendChild(el);
  });
}

/* ── MISSING REPORT ── */
function renderMissing(reports) {
  const container = document.getElementById('missingList');
  container.innerHTML = '';

  const today = new Date().toISOString().split('T')[0];
  const todaySubmitters = new Set(
    reports.filter(r => r.date === today).map(r => r.memberId)
  );

  const missing = allData.team.filter(m => !todaySubmitters.has(m.id));

  if (missing.length === 0) {
    container.innerHTML = '<div class="all-submitted">✅ 전원 제출 완료</div>';
    return;
  }

  missing.forEach(m => {
    const el = document.createElement('div');
    el.className = 'missing-item';
    el.innerHTML = `
      <div class="missing-avatar" style="background:${m.color}">${m.name[0]}</div>
      <div class="missing-info">
        <h4>${m.name}</h4>
        <span>${m.role}</span>
      </div>
      <span class="missing-badge">미제출</span>
    `;
    container.appendChild(el);
  });
}

/* ── PERIOD TABS ── */
document.querySelectorAll('.period-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    render();
    renderSchedules();
  });
});

/* ── NAV TABS ── */
document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = btn.dataset.view;
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.getElementById('view-' + currentView).classList.add('active');
  });
});

/* ════════════════════════════════════════
   SCHEDULE RENDERING
   ════════════════════════════════════════ */

function renderSchedules() {
  if (!scheduleData) return;
  renderFieldwork();
  renderLeaveCalendar();
}

/* ── 팀원 색상 조회 ── */
function getMemberColor(name) {
  if (!allData) return '#888';
  const m = allData.team.find(t => t.name === name);
  return m ? m.color : '#888';
}

/* ── 기간 레이블 ── */
function getPeriodLabel() {
  const now = new Date();
  if (currentPeriod === 'this-week') {
    const mon = getMonday(now);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return `${fmtDate(mon)} ~ ${fmtDate(sun)}`;
  }
  if (currentPeriod === 'last-week') {
    const mon = getMonday(now);
    const lastMon = new Date(mon); lastMon.setDate(mon.getDate() - 7);
    const lastSun = new Date(mon); lastSun.setDate(mon.getDate() - 1);
    return `${fmtDate(lastMon)} ~ ${fmtDate(lastSun)}`;
  }
  if (currentPeriod === 'this-month') {
    return `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
  }
  return '';
}

function fmtDate(d) {
  return `${d.getMonth()+1}/${d.getDate()}`;
}

function fmtFullDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth()+1}월 ${d.getDate()}일 (${['일','월','화','수','목','금','토'][d.getDay()]})`;
}

/* ── 필터링 ── */
function getFilteredFieldwork() {
  if (!scheduleData) return [];
  const now = new Date();
  return scheduleData.fieldwork.filter(fw => {
    const d = new Date(fw.date);
    if (currentPeriod === 'this-week') {
      const mon = getMonday(now);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return d >= mon && d <= sun;
    }
    if (currentPeriod === 'last-week') {
      const mon = getMonday(now);
      const lastMon = new Date(mon); lastMon.setDate(mon.getDate() - 7);
      const lastSun = new Date(mon); lastSun.setDate(mon.getDate() - 1);
      return d >= lastMon && d <= lastSun;
    }
    if (currentPeriod === 'this-month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    return true;
  }).sort((a,b) => a.date.localeCompare(b.date));
}

function getFilteredLeave() {
  if (!scheduleData) return [];
  const now = new Date();
  return scheduleData.leave.filter(lv => {
    const d = new Date(lv.date);
    if (currentPeriod === 'this-week') {
      const mon = getMonday(now);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return d >= mon && d <= sun;
    }
    if (currentPeriod === 'last-week') {
      const mon = getMonday(now);
      const lastMon = new Date(mon); lastMon.setDate(mon.getDate() - 7);
      const lastSun = new Date(mon); lastSun.setDate(mon.getDate() - 1);
      return d >= lastMon && d <= lastSun;
    }
    if (currentPeriod === 'this-month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    return true;
  }).sort((a,b) => a.date.localeCompare(b.date));
}

/* ── 외근 렌더링 ── */
function renderFieldwork() {
  const label = document.getElementById('fieldwork-period-label');
  if (label) label.textContent = getPeriodLabel();

  const container = document.getElementById('fieldworkCards');
  if (!container) return;
  container.innerHTML = '';

  const items = getFilteredFieldwork();

  if (items.length === 0) {
    container.innerHTML = '<div class="no-schedule">🚗 해당 기간 외근 일정이 없습니다.</div>';
  } else {
    items.forEach(fw => {
      const color = getMemberColor(fw.member);
      const badge = fw.status === 'confirmed' ? 'confirmed' : fw.status === 'pending' ? 'pending' : 'cancelled';
      const card = document.createElement('div');
      card.className = 'fieldwork-card';
      card.style.setProperty('--member-color', color);
      card.innerHTML = `
        <div class="fw-card-top">
          <div class="fw-date-badge">📅 ${fmtFullDate(fw.date)}</div>
          <span class="status-badge ${badge}">${STATUS_LABEL[fw.status]}</span>
        </div>
        <div class="fw-member-chip">
          <div class="fw-member-dot" style="background:${color}"></div>
          <div class="fw-member-name" style="color:${color}">${fw.member}</div>
        </div>
        <div class="fw-purpose">${fw.purpose}</div>
        <div class="fw-detail-row">
          <span class="fw-detail-icon">📍</span>
          <span>${fw.location}</span>
        </div>
        <div class="fw-detail-row">
          <span class="fw-detail-icon">⏰</span>
          <span>${fw.startTime} ~ ${fw.endTime}</span>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // 이번 달 미니 캘린더는 항상 이번 달 기준
  renderFieldworkCalendar();
}

function renderFieldworkCalendar() {
  const container = document.getElementById('fieldworkCalendar');
  if (!container || !scheduleData) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  // 이번 달 외근 날짜 → { date -> [members] }
  const fwMap = {};
  scheduleData.fieldwork
    .filter(fw => {
      const d = new Date(fw.date);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .forEach(fw => {
      const day = new Date(fw.date).getDate();
      if (!fwMap[day]) fwMap[day] = [];
      fwMap[day].push({ color: getMemberColor(fw.member), name: fw.member });
    });

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdays = ['일','월','화','수','목','금','토'];

  let html = `<div class="mini-cal-header">${year}년 ${month+1}월</div>`;
  html += '<div class="mini-cal-weekdays">';
  weekdays.forEach((d, i) => {
    html += `<div class="mini-cal-weekday ${i===0?'sun':i===6?'sat':''}">${d}</div>`;
  });
  html += '</div><div class="mini-cal-grid">';

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="mini-cal-day empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = (firstDay + d - 1) % 7;
    const hasFw = !!fwMap[d];
    const isToday = d === today;
    let cls = 'mini-cal-day';
    if (isToday) cls += ' today';
    if (hasFw && !isToday) cls += ' has-fieldwork';
    if (dow === 0) cls += ' sunday';
    if (dow === 6) cls += ' saturday';

    const dots = hasFw
      ? `<div class="cal-fw-dots">${fwMap[d].map(m => `<div class="cal-fw-dot" style="background:${m.color}" title="${m.name}"></div>`).join('')}</div>`
      : '';
    html += `<div class="${cls}"><div class="cal-day-num">${d}</div>${dots}</div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

/* ── 휴가 렌더링 ── */
function renderLeaveCalendar() {
  const label = document.getElementById('leave-period-label');
  if (label) label.textContent = getPeriodLabel();

  renderLeaveLegend();
  renderLeaveCalGrid();
  renderLeaveList();
}

function renderLeaveLegend() {
  const container = document.getElementById('leaveLegend');
  if (!container) return;
  const types = ['연차','반차(오전)','반차(오후)','특휴','병가'];
  container.innerHTML = types.map(t => {
    const cfg = LEAVE_TYPE_COLORS[t] || { bg: '#888', text: '#888', icon: '•' };
    return `
      <div class="leave-legend-item">
        <div class="leave-type-dot" style="background:${cfg.text}"></div>
        <span>${cfg.icon} ${t}</span>
      </div>`;
  }).join('');
}

function renderLeaveCalGrid() {
  const container = document.getElementById('leaveCalendar');
  if (!container || !scheduleData) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  // 이번 달 휴가 → day -> [leave entries]
  const leaveMap = {};
  scheduleData.leave.forEach(lv => {
    const start = new Date(lv.date);
    const end = new Date(lv.endDate || lv.date);
    if (start.getFullYear() !== year || start.getMonth() !== month) return;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getMonth() !== month) break;
      const day = d.getDate();
      if (!leaveMap[day]) leaveMap[day] = [];
      leaveMap[day].push(lv);
    }
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdays = ['일','월','화','수','목','금','토'];

  let html = `<div class="leave-cal-header">${year}년 ${month+1}월</div>`;
  html += '<div class="leave-cal-weekdays">';
  weekdays.forEach((d, i) => {
    html += `<div class="leave-cal-weekday ${i===0?'sun':i===6?'sat':''}">${d}</div>`;
  });
  html += '</div><div class="leave-cal-grid">';

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="leave-cal-day empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = (firstDay + d - 1) % 7;
    const entries = leaveMap[d] || [];
    const isToday = d === today;

    let cls = 'leave-cal-day';
    if (isToday) cls += ' today';
    if (dow === 0) cls += ' sunday';
    if (dow === 6) cls += ' saturday';

    const entriesHtml = entries.map(lv => {
      const color = getMemberColor(lv.member);
      const cfg = LEAVE_TYPE_COLORS[lv.type] || { bg: 'rgba(136,136,136,0.2)', text: '#888', icon: '•' };
      const pendingCls = lv.status === 'pending' ? ' pending-leave' : '';
      return `<div class="leave-entry${pendingCls}" style="background:${cfg.bg};color:${cfg.text}" title="${lv.member} - ${lv.type} (${STATUS_LABEL[lv.status]})">
        ${cfg.icon} ${lv.member}
      </div>`;
    }).join('');

    html += `<div class="${cls}">
      <div class="leave-day-num">${d}</div>
      ${entriesHtml}
    </div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

function renderLeaveList() {
  const container = document.getElementById('leaveList');
  if (!container || !scheduleData) return;
  container.innerHTML = '';

  const items = getFilteredLeave();

  if (items.length === 0) {
    container.innerHTML = '<div class="no-schedule">🌴 해당 기간 휴가 내역이 없습니다.</div>';
    return;
  }

  items.forEach(lv => {
    const color = getMemberColor(lv.member);
    const cfg = LEAVE_TYPE_COLORS[lv.type] || { bg: '#888', text: '#888', icon: '•' };
    const badge = lv.status === 'approved' ? 'approved' : lv.status === 'pending' ? 'pending' : 'rejected';
    const dateStr = lv.date === lv.endDate
      ? fmtFullDate(lv.date)
      : `${fmtFullDate(lv.date)} ~ ${fmtFullDate(lv.endDate)}`;

    const el = document.createElement('div');
    el.className = 'leave-list-item';
    el.innerHTML = `
      <div class="leave-member-avatar" style="background:${color}">${lv.member[0]}</div>
      <div class="leave-list-info">
        <div class="leave-list-name">${lv.member}</div>
        <div class="leave-list-date">${dateStr}</div>
        ${lv.note ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">📝 ${lv.note}</div>` : ''}
      </div>
      <div class="leave-list-right">
        <span class="status-badge ${badge}">${STATUS_LABEL[lv.status]}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${cfg.bg};color:${cfg.text};font-weight:600">${cfg.icon} ${lv.type}</span>
          <span class="leave-days-badge">${lv.days}일</span>
        </div>
      </div>
    `;
    container.appendChild(el);
  });
}

/* ── START ── */
document.addEventListener('DOMContentLoaded', init);

/* app.js — APG Korea 업무대시보드 메인 로직 */

const DAYS_KO = ['월', '화', '수', '목', '금'];
const STATUS_KO = { done: '완료', wip: '진행중', todo: '예정' };

const LEAVE_TYPE_COLORS = {
  '연차':      { bg: 'rgba(116,185,255,0.2)', text: '#74B9FF', icon: '📘' },
  '반차(오전)': { bg: 'rgba(129,236,236,0.2)', text: '#81ecec', icon: '🌅' },
  '반차(오후)': { bg: 'rgba(129,236,236,0.2)', text: '#81ecec', icon: '🌇' },
  '특휴':      { bg: 'rgba(162,155,254,0.2)', text: '#a29bfe', icon: '⭐' },
  '병가':      { bg: 'rgba(225,112,85,0.2)',  text: '#E17055', icon: '🏥' },
};

const STATUS_LABEL = {
  confirmed: '확정', pending: '대기', cancelled: '취소',
  approved:  '승인', rejected: '반려',
};

// 타입별 색상 상수
const TYPE_COLORS = {
  fieldwork: { dot: '#00B894', bg: 'rgba(0,184,148,0.15)',  text: '#00B894', label: '외근' },
  leave:     { dot: '#74B9FF', bg: 'rgba(116,185,255,0.15)', text: '#74B9FF', label: '휴가' },
  general:   { dot: '#FDCB6E', bg: 'rgba(253,203,110,0.15)', text: '#FDCB6E', label: '기타' },
};

let allData      = null;  // reports.json (reports 배열만)
let membersData  = null;  // members.json (members 배열)
let scheduleData = null;
let currentPeriod    = 'this-week';  // 레거시 호환용 (일정 필터)
let currentView      = 'work';
let selectedMember   = 'all';
let selectedCalDate  = null;

// 업무현황 기간 필터 상태
let workMode = 'weekly';   // 'daily' | 'weekly' | 'monthly'
let dailyDate = new Date(); // 일일 모드 선택 날짜
let weeklyOffset = 0;       // 주간 모드 오프셋 (0=이번주, -1=저번주, ...)
let monthlyOffset = 0;      // 월간 모드 오프셋 (0=이번달, -1=저번달, ...)

/* ── members.json → allData.team 호환 구조 ── */
function getTeam() {
  return membersData ? membersData.members : [];
}

/* ── 업무시간 포맷 ── */
function formatWorkHours(member) {
  if (!member.workStart || !member.workEnd) {
    return member.note === '무한' ? '24/7' : (member.note || '—');
  }
  return `${member.workStart} ~ ${member.workEnd}`;
}

/* ── INIT ── */
async function init() {
  setHeaderDate();
  try {
    const [reportsRes, schedulesRes, membersRes] = await Promise.all([
      fetch('./data/reports.json'),
      fetch('./data/schedules.json'),
      fetch('./data/members.json'),
    ]);
    if (!reportsRes.ok) throw new Error('reports fetch failed');
    allData = await reportsRes.json();

    if (schedulesRes.ok) {
      scheduleData = await schedulesRes.json();
    }

    if (membersRes.ok) {
      membersData = await membersRes.json();
    }

    // 일정관리 필터 옵션 팀원 목록을 members.json 기준으로 동적 생성
    populateMemberFilter();

    // 헤더 근무시간 뱃지 tooltip 업데이트
    updateWorkHoursBadge();

    render();
    renderScheduleView();
  } catch(e) {
    console.error(e);
    document.getElementById('app').innerHTML = `
      <div class="loading">
        <div style="color:#E17055;font-size:16px;">⚠️ 데이터를 불러올 수 없습니다.</div>
        <div style="color:#8888aa;font-size:13px;">data/reports.json 파일을 확인하세요.</div>
      </div>`;
  }
}

/* ── 헤더 근무시간 뱃지 tooltip ── */
function updateWorkHoursBadge() {
  const badge = document.getElementById('workHoursBadge');
  if (!badge || !membersData) return;
  const lines = membersData.members.map(m => `${m.name}: ${formatWorkHours(m)}`);
  badge.title = lines.join('\n');
}

/* ── 팀원 필터 옵션 동적 생성 ── */
function populateMemberFilter() {
  const sel = document.getElementById('memberFilterSelect');
  if (!sel || !membersData) return;
  // 기존 옵션 정리 후 재생성
  sel.innerHTML = '<option value="all">전체 팀원</option>';
  membersData.members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.name;
    opt.textContent = m.name;
    sel.appendChild(opt);
  });
}

function setHeaderDate() {
  const now  = new Date();
  const opts = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  document.getElementById('currentDate').textContent =
    now.toLocaleDateString('ko-KR', opts);
}

/* ── PERIOD FILTER ── */
function getFilteredReports() {
  if (!allData) return [];
  const now     = new Date();
  const reports = allData.reports;

  if (currentPeriod === 'this-week') {
    const mon = getMonday(now);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return reports.filter(r => { const d = new Date(r.date); return d >= mon && d <= sun; });
  }
  if (currentPeriod === 'last-week') {
    const mon     = getMonday(now);
    const lastMon = new Date(mon); lastMon.setDate(mon.getDate() - 7);
    const lastSun = new Date(mon); lastSun.setDate(mon.getDate() - 1);
    return reports.filter(r => { const d = new Date(r.date); return d >= lastMon && d <= lastSun; });
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
  const day  = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/* ── RENDER (업무현황) ── */
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
  const totalHours  = reports.reduce((s, r) => s + (r.totalHours || 0), 0);
  const totalTasks  = reports.reduce((s, r) => s + r.items.length, 0);
  const doneTasks   = reports.reduce((s, r) => s + r.items.filter(i => i.status === 'done').length, 0);
  const totalIssues = reports.reduce((s, r) => s + (r.issues || []).length, 0);
  const submitters  = new Set(reports.map(r => r.memberId)).size;

  document.getElementById('stat-hours').textContent      = totalHours.toFixed(1);
  document.getElementById('stat-tasks').textContent      = totalTasks;
  document.getElementById('stat-done').textContent       = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) + '%' : '0%';
  document.getElementById('stat-issues').textContent     = totalIssues;
  document.getElementById('stat-submitters').textContent = `${submitters}명 제출`;
}

/* ── CHARTS ── */
function renderCharts(reports) {
  const team = getTeam();
  const memberMap = {};
  const colorMap  = {};
  team.forEach(m => { colorMap[m.name] = m.color; });

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

  const catMap = {};
  reports.forEach(r => r.items.forEach(i => {
    catMap[i.category] = (catMap[i.category] || 0) + i.hours;
  }));
  renderCategoryChart({ labels: Object.keys(catMap), values: Object.values(catMap) });

  const statusMap = { done: 0, wip: 0, todo: 0 };
  reports.forEach(r => r.items.forEach(i => { statusMap[i.status] = (statusMap[i.status] || 0) + 1; }));
  renderStatusChart({
    labels: ['완료', '진행중', '예정'],
    values: [statusMap.done, statusMap.wip, statusMap.todo],
  });

  const weekLabels   = [];
  const weekDatasets = [];
  const now          = new Date();

  team.forEach((member, idx) => {
    const ds = {
      label:           member.name,
      borderColor:     member.color,
      backgroundColor: member.color + '33',
      data:            [],
    };
    for (let w = 3; w >= 0; w--) {
      const mon = getMonday(now);
      mon.setDate(mon.getDate() - w * 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const weekHours = (allData.reports || [])
        .filter(r => r.memberId === member.id)
        .filter(r => { const d = new Date(r.date); return d >= mon && d <= sun; })
        .reduce((s, r) => s + (r.totalHours || 0), 0);
      ds.data.push(weekHours);
      if (idx === 0) {
        weekLabels.push(w === 0 ? '이번주' : w === 1 ? '저번주' : w + '주전');
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
  const team = getTeam();

  team.forEach(member => {
    const memberReports = reports.filter(r => r.memberId === member.id);
    if (memberReports.length === 0) return;

    const totalHours = memberReports.reduce((s, r) => s + (r.totalHours || 0), 0);
    const allItems   = memberReports.flatMap(r => r.items);

    const dayHours = {};
    memberReports.forEach(r => {
      const d      = new Date(r.date);
      const dayIdx = d.getDay() - 1;
      if (dayIdx >= 0 && dayIdx <= 4) {
        dayHours[dayIdx] = (dayHours[dayIdx] || 0) + (r.totalHours || 0);
      }
    });
    const maxDay = Math.max(...Object.values(dayHours), 1);

    // 업무시간 표시
    const workHoursLabel = formatWorkHours(member);

    const card     = document.createElement('div');
    card.className = 'member-card';
    card.innerHTML = `
      <div class="member-work-hours-badge" style="color:${member.color};border-color:${member.color}22;background:${member.color}11">
        🕐 ${workHoursLabel}
      </div>
      <div class="member-header">
        <div class="member-avatar" style="background:${member.color}">${member.name[0]}</div>
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
                <div class="day-bar" style="height:${Math.round((dayHours[i]||0)/maxDay*100)}%;background:${member.color}99;"></div>
              </div>
              <div class="day-hours-label">${dayHours[i] ? dayHours[i].toFixed(1) : '-'}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="task-list">
        ${allItems.slice(0, 5).map(item => `
          <div class="task-item">
            <div class="task-check ${item.status}">${item.status==='done'?'✓':item.status==='wip'?'◐':''}</div>
            <div class="task-name ${item.status==='done'?'done':''}">${item.task}</div>
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
  const team = getTeam();
  const colorMap  = {};
  team.forEach(m => { colorMap[m.name] = m.color; });
  const issues = reports.flatMap(r =>
    (r.issues || []).map(issue => ({ issue, member: r.member, date: r.date, color: colorMap[r.member] || '#888' }))
  );
  if (issues.length === 0) {
    container.innerHTML = '<div class="no-issues">✅ 이슈 없음</div>';
    return;
  }
  issues.forEach(({ issue, member, date, color }) => {
    const el     = document.createElement('div');
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

/* ── MISSING ── */
function renderMissing(reports) {
  const container = document.getElementById('missingList');
  container.innerHTML = '';
  const team = getTeam();
  const today          = new Date().toISOString().split('T')[0];
  const todaySubmitters = new Set(reports.filter(r => r.date === today).map(r => r.memberId));
  const missing        = team.filter(m => !todaySubmitters.has(m.id));
  if (missing.length === 0) {
    container.innerHTML = '<div class="all-submitted">✅ 전원 제출 완료</div>';
    return;
  }
  missing.forEach(m => {
    const el     = document.createElement('div');
    el.className = 'missing-item';
    el.innerHTML = `
      <div class="missing-avatar" style="background:${m.color}">${m.name[0]}</div>
      <div class="missing-info"><h4>${m.name}</h4><span>${m.role}</span></div>
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
    renderScheduleView();
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
   SCHEDULE VIEW — 일정관리 통합 렌더링
   ════════════════════════════════════════ */

function renderScheduleView() {
  if (!scheduleData) return;
  renderUnifiedCalendar();
  renderScheduleCards();
}

/* ── 팀원 색상 ── */
function getMemberColor(name) {
  const team = getTeam();
  const m = team.find(t => t.name === name);
  return m ? m.color : '#888';
}

/* ── 날짜 포맷 ── */
function fmtDate(d) { return `${d.getMonth()+1}/${d.getDate()}`; }

function fmtFullDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth()+1}월 ${d.getDate()}일 (${['일','월','화','수','목','금','토'][d.getDay()]})`;
}

/* ── 모든 일정을 통합 배열로 ── */
function getAllScheduleItems() {
  if (!scheduleData) return [];
  const items = [];

  (scheduleData.fieldwork || []).forEach(fw => {
    items.push({
      type:      'fieldwork',
      date:      fw.date,
      endDate:   fw.date,
      member:    fw.member,
      memberId:  fw.memberId,
      title:     fw.purpose,
      location:  fw.location,
      startTime: fw.startTime,
      endTime:   fw.endTime,
      status:    fw.status,
    });
  });

  (scheduleData.leave || []).forEach(lv => {
    items.push({
      type:      'leave',
      date:      lv.date,
      endDate:   lv.endDate || lv.date,
      member:    lv.member,
      memberId:  lv.memberId,
      title:     lv.type,
      note:      lv.note,
      days:      lv.days,
      status:    lv.status,
    });
  });

  (scheduleData.general || []).forEach(gn => {
    items.push({
      type:      'general',
      date:      gn.date,
      endDate:   gn.date,
      member:    gn.member,
      memberId:  gn.memberId,
      title:     gn.title,
      location:  gn.location,
      startTime: gn.startTime,
      endTime:   gn.endTime,
      status:    gn.status,
    });
  });

  return items.sort((a, b) => a.date.localeCompare(b.date));
}

/* ── ① 통합 캘린더 렌더링 ── */
function renderUnifiedCalendar() {
  const container = document.getElementById('unifiedCalendar');
  const labelEl   = document.getElementById('schedule-month-label');
  if (!container) return;

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  if (labelEl) labelEl.textContent = `${year}년 ${month+1}월`;

  // 날짜별 일정 맵 { day -> [{type, items}] }
  const dayMap = {};
  getAllScheduleItems().forEach(item => {
    const start = new Date(item.date);
    const end   = new Date(item.endDate || item.date);
    if (start.getFullYear() !== year || start.getMonth() !== month) return;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getMonth() !== month) break;
      const day = d.getDate();
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(item);
    }
  });

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdays    = ['일','월','화','수','목','금','토'];

  let html = '<div class="ucal-weekdays">';
  weekdays.forEach((d, i) => {
    html += `<div class="ucal-weekday ${i===0?'sun':i===6?'sat':''}">${d}</div>`;
  });
  html += '</div><div class="ucal-grid">';

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="ucal-day empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dow      = (firstDay + d - 1) % 7;
    const items    = dayMap[d] || [];
    const isToday  = d === today;
    const dateStr  = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

    let cls = 'ucal-day';
    if (isToday)    cls += ' today';
    if (dow === 0)  cls += ' sunday';
    if (dow === 6)  cls += ' saturday';
    if (items.length) cls += ' has-events';

    // 일정 아이템 표시 (최대 3개, 초과 시 "+N건")
    const MAX_SHOW = 3;
    const shown    = items.slice(0, MAX_SHOW);
    const extra    = items.length - MAX_SHOW;

    const eventItems = shown.map(item => {
      const c     = TYPE_COLORS[item.type] || TYPE_COLORS.general;
      const label = c.label;
      const name  = item.member || '';
      const title = item.title || item.description || '';
      const text  = name ? `${name} • ${title}` : title;
      return `<div class="ucal-event-item" style="border-left:3px solid ${c.dot};background:${c.bg}" title="[${label}] ${text}">
        <span class="ucal-event-type">${label}</span><span class="ucal-event-text">${text}</span>
      </div>`;
    }).join('');

    const moreHtml = extra > 0
      ? `<div class="ucal-event-more">+${extra}건 더보기</div>`
      : '';

    html += `<div class="${cls}" data-date="${dateStr}" onclick="showDayDetail('${dateStr}')">
      <div class="ucal-day-num">${d}</div>
      ${eventItems}${moreHtml}
    </div>`;
  }

  html += '</div>';

  // 범례
  html += `<div class="ucal-legend">
    ${Object.entries(TYPE_COLORS).map(([t, c]) =>
      `<div class="ucal-legend-item">
        <div class="ucal-dot" style="background:${c.dot}"></div>
        <span>${c.label}</span>
      </div>`
    ).join('')}
  </div>`;

  container.innerHTML = html;

  // 팝업 닫기 — 캘린더 바깥 클릭
  document.addEventListener('click', function hidePop(e) {
    const popup = document.getElementById('calDetailPopup');
    const cal   = document.getElementById('unifiedCalendar');
    if (popup && !popup.contains(e.target) && !cal.contains(e.target)) {
      popup.style.display = 'none';
      document.removeEventListener('click', hidePop);
    }
  });
}

/* ── 날짜 클릭 상세 ── */
function showDayDetail(dateStr) {
  const popup    = document.getElementById('calDetailPopup');
  const dateEl   = document.getElementById('calDetailDate');
  const listEl   = document.getElementById('calDetailList');
  if (!popup) return;

  const items = getAllScheduleItems().filter(item => {
    const start = new Date(item.date);
    const end   = new Date(item.endDate || item.date);
    const target = new Date(dateStr);
    return target >= start && target <= end;
  });

  if (items.length === 0) { popup.style.display = 'none'; return; }

  dateEl.textContent = fmtFullDate(dateStr);
  listEl.innerHTML   = items.map(item => {
    const tc    = TYPE_COLORS[item.type];
    const color = getMemberColor(item.member);
    const time  = item.startTime ? `${item.startTime}${item.endTime ? ' ~ ' + item.endTime : ''}` : '';
    return `<div class="cal-detail-item">
      <span class="sched-type-badge" style="background:${tc.bg};color:${tc.text}">${tc.label}</span>
      <div class="cal-detail-content">
        <div class="cal-detail-title">${item.title}</div>
        <div class="cal-detail-meta">
          <span class="member-chip" style="color:${color}">● ${item.member}</span>
          ${time ? `<span>⏰ ${time}</span>` : ''}
          ${item.location ? `<span>📍 ${item.location}</span>` : ''}
        </div>
      </div>
      <span class="status-badge ${item.status}">${STATUS_LABEL[item.status]}</span>
    </div>`;
  }).join('');

  popup.style.display = 'block';
}

/* ── ② 일정 카드 목록 렌더링 ── */
function renderScheduleCards() {
  const container = document.getElementById('scheduleCardsList');
  if (!container) return;
  container.innerHTML = '';

  let items = getAllScheduleItems();

  // 팀원 필터
  if (selectedMember !== 'all') {
    items = items.filter(i => i.member === selectedMember);
  }

  if (items.length === 0) {
    container.innerHTML = `<div class="no-schedule">📭 ${selectedMember === 'all' ? '등록된' : selectedMember + '의'} 일정이 없습니다.</div>`;
    return;
  }

  items.forEach(item => {
    const tc    = TYPE_COLORS[item.type];
    const color = getMemberColor(item.member);
    const badge = item.status === 'confirmed' || item.status === 'approved' ? 'confirmed' :
                  item.status === 'pending' ? 'pending' : 'cancelled';
    const time  = item.startTime
      ? `<div class="sched-row"><span class="sched-icon">⏰</span><span>${item.startTime}${item.endTime ? ' ~ ' + item.endTime : ''}</span></div>`
      : (item.days ? `<div class="sched-row"><span class="sched-icon">📆</span><span>${item.days}일</span></div>` : '');
    const loc   = item.location
      ? `<div class="sched-row"><span class="sched-icon">📍</span><span>${item.location}</span></div>`
      : '';
    const note  = item.note
      ? `<div class="sched-row"><span class="sched-icon">📝</span><span>${item.note}</span></div>`
      : '';

    const dateStr = item.date === item.endDate
      ? fmtFullDate(item.date)
      : `${fmtFullDate(item.date)} ~ ${fmtFullDate(item.endDate)}`;

    const card     = document.createElement('div');
    card.className = 'sched-card';
    card.style.setProperty('--member-color', color);
    card.innerHTML = `
      <div class="sched-card-top">
        <div class="sched-left">
          <span class="sched-type-badge" style="background:${tc.bg};color:${tc.text}">${tc.label}</span>
          <span class="sched-date-text">📅 ${dateStr}</span>
        </div>
        <span class="status-badge ${badge}">${STATUS_LABEL[item.status]}</span>
      </div>
      <div class="sched-title">${item.title}</div>
      <div class="sched-member-chip">
        <div class="sched-member-dot" style="background:${color}"></div>
        <span style="color:${color};font-weight:700;font-size:13px">${item.member}</span>
      </div>
      <div class="sched-details">
        ${time}${loc}${note}
      </div>
    `;
    container.appendChild(card);
  });
}

/* ── 팀원 필터 이벤트 ── */
document.addEventListener('DOMContentLoaded', () => {
  const filterSel = document.getElementById('memberFilterSelect');
  if (filterSel) {
    filterSel.addEventListener('change', () => {
      selectedMember = filterSel.value;
      renderScheduleCards();
    });
  }
});

/* ── START ── */
document.addEventListener('DOMContentLoaded', init);

/* app.js — APG Korea 업무대시보드 메인 로직 (i18n 지원) */

/* ── 번역 헬퍼 ── */
function t(key) { return i18n.t(key); }

/* ── 요일 배열 (i18n) ── */
function getDaysShort() {
  return [t('mon'), t('tue'), t('wed'), t('thu'), t('fri')];
}
function getWeekdaysLong() {
  return [t('sun'), t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat')];
}

/* ── 카테고리 번역 ── */
function translateCategory(cat) {
  const map = {
    '영업': t('categories.sales'),
    '기획': t('categories.planning'),
    '운영': t('categories.ops'),
    '행정': t('categories.admin'),
    '미팅': t('categories.meeting'),
    // 영→한 역방향도 지원
    'Sales': t('categories.sales'),
    'Planning': t('categories.planning'),
    'Operations': t('categories.ops'),
    'Admin': t('categories.admin'),
    'Meeting': t('categories.meeting'),
  };
  return map[cat] || cat;
}

/* ── role 번역 ── */
function translateRole(role) {
  const map = {
    '대표': t('roles.ceo'),
    '실장': t('roles.gm'),
    '차장': t('roles.manager'),
    '부장': t('roles.director'),
    'CEO': t('roles.ceo'),
    'GM': t('roles.gm'),
    'Manager': t('roles.manager'),
    'Director': t('roles.director'),
  };
  return map[role] || role;
}

/* ── 휴가 타입 번역 ── */
function translateLeaveType(type) {
  const map = {
    '연차': t('annual'),
    '반차(오전)': t('halfDayAM'),
    '반차(오후)': t('halfDayPM'),
    '특휴': t('special'),
    '병가': t('sick'),
  };
  return map[type] || type;
}

/* ── STATUS 레이블 (i18n) ── */
function getStatusLabels() {
  return {
    done: t('done'),
    wip:  t('inProgress'),
    todo: t('todo'),
  };
}

/* ── STATUS_LABEL for schedule (i18n) ── */
function getScheduleStatusLabel(status) {
  const map = {
    confirmed: t('confirmed'),
    pending:   t('pending'),
    cancelled: t('cancelled'),
    approved:  t('approved'),
    rejected:  t('rejected'),
  };
  return map[status] || status;
}

/* ── TYPE_COLORS (label도 번역) ── */
function getTypeColors() {
  return {
    fieldwork: { dot: '#00B894', bg: 'rgba(0,184,148,0.15)',   text: '#00B894', label: t('fieldwork') },
    leave:     { dot: '#74B9FF', bg: 'rgba(116,185,255,0.15)', text: '#74B9FF', label: t('leave') },
    general:   { dot: '#FDCB6E', bg: 'rgba(253,203,110,0.15)', text: '#FDCB6E', label: t('general') },
    common:    { dot: '#6C5CE7', bg: 'rgba(108,92,231,0.15)',  text: '#6C5CE7', label: t('common') },
  };
}

/* ── LEAVE_TYPE_COLORS ── */
const LEAVE_TYPE_COLORS = {
  '연차':      { bg: 'rgba(116,185,255,0.2)', text: '#74B9FF', icon: '📘' },
  '반차(오전)': { bg: 'rgba(129,236,236,0.2)', text: '#81ecec', icon: '🌅' },
  '반차(오후)': { bg: 'rgba(129,236,236,0.2)', text: '#81ecec', icon: '🌇' },
  '특휴':      { bg: 'rgba(162,155,254,0.2)', text: '#a29bfe', icon: '⭐' },
  '병가':      { bg: 'rgba(225,112,85,0.2)',  text: '#E17055', icon: '🏥' },
};

let allData      = null;
let membersData  = null;
let scheduleData = null;
let currentPeriod    = 'this-week';
let currentView      = 'work';
let selectedMember   = 'all';
let selectedCalDate  = null;

let workMode     = 'weekly';
let dailyDate    = new Date();
let weeklyOffset = 0;
let monthlyOffset = 0;

/* ── members.json → team 배열 ── */
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

    if (schedulesRes.ok) scheduleData = await schedulesRes.json();
    if (membersRes.ok)   membersData  = await membersRes.json();

    populateMemberFilter();
    updateWorkHoursBadge();
    applyStaticI18n();
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

/* ── 정적 HTML 요소 i18n 적용 ── */
function applyStaticI18n() {
  // data-i18n 속성 일괄 처리
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = t(key);
    if (el.classList.contains('nav-tab') || el.classList.contains('work-mode-tab')) {
      const icon = el.textContent.match(/^[^\s\u00-\uFF]+/)?.[0] || el.textContent[0] || '';
      el.textContent = `${icon} ${val}`;
    } else {
      el.textContent = val;
    }
  });

  // 근무시간 뱃지 텍스트
  const badge = document.getElementById('workHoursBadge');
  if (badge) badge.innerHTML = `🕐 ${t('workHoursBadgeText')}`;

  // 헤더 타이틀
  const titleEl = document.querySelector('.header-title');
  if (titleEl) titleEl.innerHTML = `APG <span>Korea</span> ${t('dashboardTitle')}`;

  // stat 라벨/서브
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('stat-label-hours',  t('totalHours'));
  setEl('stat-sub-hours',    t('hours'));
  setEl('stat-label-tasks',  t('totalTasksLabel'));
  setEl('stat-label-done',   t('completionRate'));
  setEl('stat-sub-done',     t('completionRateSub'));
  setEl('stat-label-issues', t('issuesLabel'));
  setEl('stat-sub-issues',   t('issuesSub'));

  // 차트 카드 제목 (id 기반)
  setEl('chart-title-member',   t('memberHoursChart'));
  setEl('chart-title-category', t('categoryChart'));
  setEl('chart-title-status',   t('statusChart'));

  // 섹션 타이틀 (id 기반으로 직접)
  updateSectionTitles();

  // 일정관리 섹션 제목들
  updateScheduleSectionTitles();
}

function updateSectionTitles() {
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setTxt('section-member-cards',  `👥 ${t('memberCardsTitle')}`);
  setTxt('section-issue-board',   `⚠️ ${t('issueBoard')}`);
  setTxt('section-missing-report', `🔴 ${t('missingReport')}`);
}

function updateScheduleSectionTitles() {
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setTxt('section-calendar',       `📅 ${t('calendarTitle')}`);
  setTxt('section-schedule-list',  `📋 ${t('scheduleList')}`);
  setTxt('section-schedule-guide', `💬 ${t('scheduleGuide')}`);

  const guideDesc = document.querySelector('.guide-desc');
  if (guideDesc) guideDesc.textContent = t('guideDesc');

  // 가이드 배지
  const setTxt2 = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setTxt2('guide-badge-fieldwork', t('fieldwork'));
  setTxt2('guide-badge-leave',     t('leave'));
  setTxt2('guide-badge-general',   t('general'));
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
  sel.innerHTML = `<option value="all">${t('allMembers')}</option>`;
  membersData.members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.name;
    opt.textContent = m.name;
    sel.appendChild(opt);
  });
}

function setHeaderDate() {
  const now  = new Date();
  const lang = i18n.lang;
  const locale = lang === 'en' ? 'en-US' : 'ko-KR';
  const opts   = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  document.getElementById('currentDate').textContent = now.toLocaleDateString(locale, opts);
}

/* ── PERIOD FILTER ── */
function getMonday(d) {
  const date = new Date(d);
  const day  = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekOfMonth(d) {
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  return Math.ceil((d.getDate() + (firstDay === 0 ? 6 : firstDay - 1)) / 7);
}

function getFilteredReports() {
  if (!allData) return [];
  const now     = new Date();
  const reports = allData.reports;

  if (workMode === 'daily') {
    const dateStr = dailyDate.toISOString().split('T')[0];
    return reports.filter(r => r.date === dateStr);
  }

  if (workMode === 'weekly') {
    const base = new Date(now);
    base.setDate(base.getDate() + weeklyOffset * 7);
    const mon = getMonday(base);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return reports.filter(r => { const d = new Date(r.date); return d >= mon && d <= sun; });
  }

  if (workMode === 'monthly') {
    const base = new Date(now.getFullYear(), now.getMonth() + monthlyOffset, 1);
    return reports.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === base.getFullYear() && d.getMonth() === base.getMonth();
    });
  }

  return reports;
}

function getFilteredReportsLegacy() {
  if (!allData) return [];
  return allData.reports;
}

/* ── RENDER ── */
function render() {
  updatePeriodUI();
  const reports = getFilteredReports();
  renderStats(reports);
  renderCharts(reports);
  renderDailySummaryPanel(reports);
  renderMemberCards(reports);
  renderIssues(reports);
  renderMissing(reports);
}

/* ── 전체 UI 재렌더 (언어 변경 시) ── */
function rerenderAll() {
  setHeaderDate();
  applyStaticI18n();
  populateMemberFilter();
  updateWorkHoursBadge();
  updateLangButtons();
  render();
  renderScheduleView();
}

/* ── 일일 요약 패널 ── */
function renderDailySummaryPanel(reports) {
  let container = document.getElementById('dailySummaryPanel');
  if (!container) return;

  const withSummary = reports.filter(r => r.summary);
  if (withSummary.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';

  const dateGroups = {};
  withSummary.forEach(r => {
    if (!dateGroups[r.date]) dateGroups[r.date] = [];
    dateGroups[r.date].push(r);
  });

  const WEEKDAYS = getWeekdaysLong();

  const html = Object.keys(dateGroups).sort().reverse().map(dateStr => {
    const d = new Date(dateStr + 'T00:00:00');
    const mStr = `${d.getMonth()+1}/${d.getDate()}`;
    const wStr = WEEKDAYS[d.getDay()];
    const rows = dateGroups[dateStr].map(r => `
      <div class="daily-summary-row">
        <span class="summary-member">${r.member}:</span>
        <span class="summary-text">${r.summary}</span>
      </div>
    `).join('');
    return `
      <div class="daily-summary-date-group">
        <div class="daily-summary-date-label">📅 ${mStr} (${wStr})</div>
        <div class="daily-summary-rows">${rows}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="daily-summary-panel-title">📋 ${t('teamSummaryTitle')}</div>
    ${html}
  `;
}

/* ── 기간 UI 업데이트 ── */
function updatePeriodUI() {
  const now = new Date();
  const titleEl   = document.getElementById('charts-section-title');
  const trendTitle = document.getElementById('trend-chart-title');

  // 네비 버튼 텍스트 업데이트
  const weekPrev = document.getElementById('weekly-prev');
  const weekNext = document.getElementById('weekly-next');
  const monthPrev = document.getElementById('monthly-prev');
  const monthNext = document.getElementById('monthly-next');
  if (weekPrev)  weekPrev.textContent  = '←';
  if (weekNext)  weekNext.textContent  = '→';
  if (monthPrev) monthPrev.textContent = '←';
  if (monthNext) monthNext.textContent = '→';

  if (workMode === 'daily') {
    if (titleEl)    titleEl.textContent  = `📊 ${t('dailyStatusTitle')}`;
    if (trendTitle) trendTitle.textContent = t('teamMemberHours');
    document.getElementById('daily-nav').style.display   = 'flex';
    document.getElementById('weekly-nav').style.display  = 'none';
    document.getElementById('monthly-nav').style.display = 'none';
  } else if (workMode === 'weekly') {
    if (titleEl)    titleEl.textContent  = `📊 ${t('weeklyStatusTitle')}`;
    if (trendTitle) trendTitle.textContent = t('weeklyTrendTitle');
    document.getElementById('daily-nav').style.display   = 'none';
    document.getElementById('weekly-nav').style.display  = 'flex';
    document.getElementById('monthly-nav').style.display = 'none';

    const base = new Date(now);
    base.setDate(base.getDate() + weeklyOffset * 7);
    const mon = getMonday(base);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 4);
    const weekNum = getWeekOfMonth(mon);

    let label;
    if (i18n.lang === 'en') {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      label = `${months[mon.getMonth()]} ${mon.getFullYear()} W${weekNum} (${mon.getMonth()+1}/${mon.getDate()}~${sun.getMonth()+1}/${sun.getDate()})`;
    } else {
      label = `${mon.getFullYear()}년 ${mon.getMonth()+1}월 ${weekNum}주차 (${mon.getMonth()+1}/${mon.getDate()}~${sun.getMonth()+1}/${sun.getDate()})`;
    }
    document.getElementById('weekly-label').textContent = label;
  } else if (workMode === 'monthly') {
    if (titleEl)    titleEl.textContent  = `📊 ${t('monthlyStatusTitle')}`;
    if (trendTitle) trendTitle.textContent = t('dailyTrendTitle');
    document.getElementById('daily-nav').style.display   = 'none';
    document.getElementById('weekly-nav').style.display  = 'none';
    document.getElementById('monthly-nav').style.display = 'flex';

    const base = new Date(now.getFullYear(), now.getMonth() + monthlyOffset, 1);
    if (i18n.lang === 'en') {
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      document.getElementById('monthly-label').textContent = `${months[base.getMonth()]} ${base.getFullYear()}`;
    } else {
      document.getElementById('monthly-label').textContent = `${base.getFullYear()}년 ${base.getMonth()+1}월`;
    }
  }
}

/* ── STATS ── */
function renderStats(reports) {
  const totalHours  = reports.reduce((s, r) => s + (r.totalHours || 0), 0);
  const totalTasks  = reports.reduce((s, r) => s + r.items.length, 0);
  const doneTasks   = reports.reduce((s, r) => s + r.items.filter(i => i.status === 'done').length, 0);
  const totalIssues = reports.reduce((s, r) => s + (r.issues || []).length, 0);
  const submitters  = new Set(reports.map(r => r.memberId)).size;

  if (workMode === 'monthly') {
    const workDays = new Set(reports.map(r => r.date)).size || 1;
    const avgHours = workDays > 0 ? (totalHours / workDays) : 0;
    document.getElementById('stat-hours').textContent      = totalHours.toFixed(1);
    document.getElementById('stat-submitters').textContent = `${t('dailyAvgPrefix')} ${avgHours.toFixed(1)}h`;
  } else {
    document.getElementById('stat-hours').textContent      = totalHours.toFixed(1);
    document.getElementById('stat-submitters').textContent = `${submitters}${t('membersSubmitted')}`;
  }

  document.getElementById('stat-tasks').textContent  = totalTasks;
  document.getElementById('stat-done').textContent   = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) + '%' : '0%';
  document.getElementById('stat-issues').textContent = totalIssues;
}

/* ── CHARTS ── */
function renderCharts(reports) {
  const team     = getTeam();
  const colorMap = {};
  team.forEach(m => { colorMap[m.name] = m.color; });

  const memberMap = {};
  reports.forEach(r => {
    if (!memberMap[r.member]) memberMap[r.member] = 0;
    memberMap[r.member] += r.totalHours || 0;
  });
  const memberNames = Object.keys(memberMap);
  renderMemberHoursChart({
    labels: memberNames,
    values: memberNames.map(n => memberMap[n]),
    colors: memberNames.map(n => colorMap[n] || '#888'),
    unitLabel: t('hoursShort'),
  });

  // 카테고리 — 번역된 라벨로
  const catMap = {};
  reports.forEach(r => r.items.forEach(i => {
    const catLabel = translateCategory(i.category);
    catMap[catLabel] = (catMap[catLabel] || 0) + i.hours;
  }));

  // 상태 번역
  const statusLabels = [t('done'), t('inProgress'), t('todo')];
  const statusMap = { done: 0, wip: 0, todo: 0 };
  reports.forEach(r => r.items.forEach(i => { statusMap[i.status] = (statusMap[i.status] || 0) + 1; }));

  renderCategoryChart({
    labels: Object.keys(catMap),
    values: Object.values(catMap),
    unitLabel: t('hoursShort'),
  });

  renderStatusChart({
    labels: statusLabels,
    values: [statusMap.done, statusMap.wip, statusMap.todo],
  });

  const now = new Date();
  if (workMode === 'daily') {
    renderDailyBarChart(reports, colorMap);
  } else if (workMode === 'weekly') {
    const weekLabels   = [];
    const weekDatasets = [];
    const base = new Date(now);
    base.setDate(base.getDate() + weeklyOffset * 7);

    team.forEach((member, idx) => {
      const ds = {
        label:           member.name,
        borderColor:     member.color,
        backgroundColor: member.color + '33',
        data:            [],
      };
      for (let w = 3; w >= 0; w--) {
        const refBase = new Date(base);
        refBase.setDate(refBase.getDate() - w * 7);
        const mon = getMonday(refBase);
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        const weekHours = (allData.reports || [])
          .filter(r => r.memberId === member.id)
          .filter(r => { const d = new Date(r.date); return d >= mon && d <= sun; })
          .reduce((s, r) => s + (r.totalHours || 0), 0);
        ds.data.push(weekHours);
        if (idx === 0) {
          if (w === 0) weekLabels.push(t('thisWeek'));
          else if (w === 1) weekLabels.push(t('lastWeek'));
          else weekLabels.push(w + t('weeksAgoSuffix'));
        }
      }
      weekDatasets.push(ds);
    });
    renderWeeklyTrendChart({ labels: weekLabels, datasets: weekDatasets });
  } else if (workMode === 'monthly') {
    const base = new Date(now.getFullYear(), now.getMonth() + monthlyOffset, 1);
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const dayLabels = [];
    const dayHoursMap = {};

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      dayLabels.push(`${base.getMonth()+1}/${d}`);
      dayHoursMap[dateStr] = 0;
    }
    reports.forEach(r => {
      if (dayHoursMap[r.date] !== undefined) {
        dayHoursMap[r.date] += (r.totalHours || 0);
      }
    });
    const dateKeys = Object.keys(dayHoursMap).sort();
    renderWeeklyTrendChart({
      labels: dayLabels,
      datasets: [{
        label: t('dailyTrendTitle'),
        borderColor: '#6C5CE7',
        backgroundColor: 'rgba(108,92,231,0.15)',
        data: dateKeys.map(k => dayHoursMap[k]),
        fill: true,
      }]
    });
  }
}

/* 일일 모드 4번째 차트 */
function renderDailyBarChart(reports, colorMap) {
  const catMap = {};
  reports.forEach(r => r.items.forEach(i => {
    const catLabel = translateCategory(i.category);
    catMap[catLabel] = (catMap[catLabel] || 0) + i.hours;
  }));
  const CAT_COLORS_EN = {
    [t('categories.sales')]:    '#6C5CE7',
    [t('categories.planning')]: '#00B894',
    [t('categories.ops')]:      '#FDCB6E',
    [t('categories.admin')]:    '#74B9FF',
    [t('categories.meeting')]:  '#E17055',
  };
  const labels = Object.keys(catMap);
  renderWeeklyTrendChart({
    labels,
    datasets: [{
      label: t('hours'),
      borderColor: labels.map(l => CAT_COLORS_EN[l] || '#888'),
      backgroundColor: labels.map(l => (CAT_COLORS_EN[l] || '#888') + 'aa'),
      data: labels.map(l => catMap[l]),
      type: 'bar',
    }]
  });
}

/* ── 상태 아이콘 ── */
function statusIcon(status) {
  if (status === 'done') return '✅';
  if (status === 'wip')  return '🔄';
  return '📅';
}

/* ── 우선순위 아이콘 ── */
function priorityIcon(priority) {
  if (priority === 'high') return `<span class="task-priority-icon" title="${t('high')}">🔴</span>`;
  if (priority === 'low')  return `<span class="task-priority-icon" title="${t('low')}" style="opacity:0.5">🔵</span>`;
  return '';
}

/* ── 날짜 버튼 포맷 헬퍼 ── */
function formatDateBtn(dateStr) {
  const WEEKDAYS_KO = ['일','월','화','수','목','금','토'];
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth()+1}/${d.getDate()}(${WEEKDAYS_KO[d.getDay()]})`;
}

/* ── 팀원 카드 날짜 선택 핸들러 ── */
function selectMemberDate(memberId, dateStr, card) {
  // 버튼 active 토글
  card.querySelectorAll('.date-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.date === dateStr);
  });

  // 선택 날짜 보고서 찾기
  const dayReports = (allData ? allData.reports : []).filter(
    r => r.memberId === memberId && r.date === dateStr
  );
  const dayItems     = dayReports.flatMap(r => r.items);
  const dayHours     = dayReports.reduce((s, r) => s + (r.totalHours || 0), 0);
  const dayIssues    = dayReports.flatMap(r => r.issues || []);
  const daySummary   = dayReports.find(r => r.summary)?.summary || null;

  const wrapper = card.querySelector('.task-list-wrapper');
  if (!wrapper) return;

  const taskListHTML = dayItems.map(item => `
    <div class="task-item" style="flex-direction:column;align-items:stretch;gap:0;">
      <div class="task-item-header">
        <span class="task-status-icon">✅</span>
        <div class="task-name-wrap">
          <span class="task-name done">${item.task}</span>
        </div>
        ${priorityIcon(item.priority)}
        <div class="task-meta" style="flex-shrink:0;">
          <span class="category-badge cat-${item.category}">${translateCategory(item.category)}</span>
          <span class="task-hours">${item.hours}${t('hoursShort')}</span>
        </div>
      </div>
      ${item.description ? `<div class="task-description">${item.description}</div>` : ''}
    </div>
  `).join('');

  const issuesHTML = dayIssues.length > 0 ? `
    <div class="card-divider"></div>
    <div class="card-issues-section">
      ${dayIssues.map(issue => `
        <div class="issue-row">
          <span class="issue-icon-sm">⚠️</span>
          <span>${issue}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  const summaryHTML = daySummary ? `
    <div class="card-summary-box">
      <span class="card-summary-icon">💬</span>
      <span>${daySummary}</span>
    </div>
  ` : '';

  wrapper.innerHTML = `
    <div class="task-list">${taskListHTML || `<div style="color:var(--text-muted);font-size:13px;padding:8px 0;">${t('noData') || '데이터 없음'}</div>`}</div>
    ${issuesHTML}
    ${summaryHTML}
    <div class="date-total-hours" style="text-align:right;font-size:12px;color:var(--text-muted);margin-top:8px;">
      업무시간: <strong>${dayHours.toFixed(1)}h</strong>
    </div>
  `;
}

/* ── MEMBER CARDS ── */
function renderMemberCards(reports) {
  const container = document.getElementById('memberCards');
  container.innerHTML = '';
  const team = getTeam();
  const DAYS_SHORT = getDaysShort();

  team.forEach(member => {
    const memberReports = reports.filter(r => r.memberId === member.id);
    if (memberReports.length === 0) return;

    const totalHours     = memberReports.reduce((s, r) => s + (r.totalHours || 0), 0);
    const allItems       = memberReports.flatMap(r => r.items);
    const doneCount      = allItems.filter(i => i.status === 'done').length;
    const workHoursLabel = formatWorkHours(member);

    const sortedReports  = [...memberReports].sort((a, b) => b.date.localeCompare(a.date));
    const allIssues      = memberReports.flatMap(r => r.issues || []);
    const latestSummary  = sortedReports.find(r => r.summary)?.summary || null;

    // 전체 히스토리 날짜 목록 (최근순)
    const allMemberReports = allData ? allData.reports.filter(r => r.memberId === member.id) : memberReports;
    const allDates = [...new Set(allMemberReports.map(r => r.date))].sort((a, b) => b.localeCompare(a));
    const currentDates = new Set(memberReports.map(r => r.date));
    // 기본 선택: 현재 기간 가장 최근 날짜
    const defaultDate = allDates.find(d => currentDates.has(d)) || allDates[0] || null;

    let timelineHTML = '';

    if (workMode === 'daily') {
      timelineHTML = '';
    } else if (workMode === 'weekly') {
      const dayHours = {};
      memberReports.forEach(r => {
        const d      = new Date(r.date);
        const dayIdx = d.getDay() - 1;
        if (dayIdx >= 0 && dayIdx <= 4) {
          dayHours[dayIdx] = (dayHours[dayIdx] || 0) + (r.totalHours || 0);
        }
      });
      const maxDay = Math.max(...Object.values(dayHours), 1);
      timelineHTML = `
        <div class="timeline">
          <div class="timeline-title">${t('dailyWorkHours')}</div>
          <div class="timeline-days">
            ${DAYS_SHORT.map((d, i) => `
              <div class="day-slot">
                <div class="day-label">${d}</div>
                <div class="day-bar-wrap">
                  <div class="day-bar" style="height:${Math.round((dayHours[i]||0)/maxDay*100)}%;background:${member.color}99;"></div>
                </div>
                <div class="day-hours-label">${dayHours[i] ? dayHours[i].toFixed(1) : '-'}</div>
              </div>
            `).join('')}
          </div>
        </div>`;
    } else if (workMode === 'monthly') {
      const weekSummary = {};
      memberReports.forEach(r => {
        const d  = new Date(r.date);
        const wk = getWeekOfMonth(d);
        weekSummary[wk] = (weekSummary[wk] || 0) + (r.totalHours || 0);
      });
      const weekRows = Object.keys(weekSummary).sort().map(wk => {
        const weekLabel = i18n.lang === 'en' ? `W${wk}` : `${wk}${t('weekUnit')}`;
        return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid #f0f0f0;">
          <span style="color:var(--text-muted)">${weekLabel}</span>
          <span style="font-weight:600;color:${member.color}">${weekSummary[wk].toFixed(1)}h</span>
        </div>`;
      }).join('');
      timelineHTML = `
        <div class="timeline">
          <div class="timeline-title">${t('weekSummaryTitle')}</div>
          <div style="margin-top:6px">${weekRows || `<div style="color:var(--text-muted);font-size:12px">${t('noData')}</div>`}</div>
        </div>`;
    }

    // 날짜 선택 버튼 HTML
    const dateBtnsHTML = allDates.length > 0 ? `
      <div class="date-selector-bar">
        <span class="date-selector-label">보고서:</span>
        <div class="date-btns">
          ${allDates.map(d => `
            <button class="date-btn ${currentDates.has(d) ? 'date-btn-current' : 'date-btn-past'}${d === defaultDate ? ' active' : ''}"
              data-date="${d}" data-member-id="${member.id}">
              ${formatDateBtn(d)}
            </button>
          `).join('')}
        </div>
      </div>
    ` : '';

    // 기본 날짜 업무목록
    const defaultReports = defaultDate
      ? allMemberReports.filter(r => r.date === defaultDate)
      : memberReports;
    const defaultItems   = defaultReports.flatMap(r => r.items);
    const defaultHours   = defaultReports.reduce((s, r) => s + (r.totalHours || 0), 0);
    const defaultIssues  = defaultReports.flatMap(r => r.issues || []);
    const defaultSummary = defaultReports.find(r => r.summary)?.summary || null;

    const defaultTaskListHTML = defaultItems.map(item => `
      <div class="task-item" style="flex-direction:column;align-items:stretch;gap:0;">
        <div class="task-item-header">
          <span class="task-status-icon">✅</span>
          <div class="task-name-wrap">
            <span class="task-name ${item.status === 'done' ? 'done' : ''}">${item.task}</span>
          </div>
          ${priorityIcon(item.priority)}
          <div class="task-meta" style="flex-shrink:0;">
            <span class="category-badge cat-${item.category}">${translateCategory(item.category)}</span>
            <span class="task-hours">${item.hours}${t('hoursShort')}</span>
          </div>
        </div>
        ${item.description ? `<div class="task-description">${item.description}</div>` : ''}
      </div>
    `).join('');

    const defaultIssuesHTML = defaultIssues.length > 0 ? `
      <div class="card-divider"></div>
      <div class="card-issues-section">
        ${defaultIssues.map(issue => `
          <div class="issue-row">
            <span class="issue-icon-sm">⚠️</span>
            <span>${issue}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    const defaultSummaryHTML = defaultSummary ? `
      <div class="card-summary-box">
        <span class="card-summary-icon">💬</span>
        <span>${defaultSummary}</span>
      </div>
    ` : '';

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
          <div class="role">${translateRole(member.role)}</div>
        </div>
        <div class="member-hours">
          <div class="hours-val" style="color:${member.color}">${totalHours.toFixed(1)}</div>
          <div class="hours-label">${t('hours')}</div>
        </div>
      </div>
      <div class="member-stat-row">
        <div class="member-stat-item">✅ ${t('done')} <strong>${doneCount}</strong></div>
      </div>
      ${dateBtnsHTML}
      ${timelineHTML}
      <div class="task-list-wrapper">
        <div class="task-list">${defaultTaskListHTML || `<div style="color:var(--text-muted);font-size:13px;padding:8px 0;">${t('noData') || '데이터 없음'}</div>`}</div>
        ${defaultIssuesHTML}
        ${defaultSummaryHTML}
        ${defaultDate ? `<div class="date-total-hours" style="text-align:right;font-size:12px;color:var(--text-muted);margin-top:8px;">업무시간: <strong>${defaultHours.toFixed(1)}h</strong></div>` : ''}
      </div>
    `;

    // 날짜 버튼 클릭 이벤트 연결
    card.querySelectorAll('.date-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectMemberDate(btn.dataset.memberId, btn.dataset.date, card);
      });
    });

    container.appendChild(card);
  });

  if (container.children.length === 0) {
    container.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:40px;">${t('noPeriodData')}</div>`;
  }
}

/* ── MEMBER MINI DASHBOARD ── */
function renderMemberMiniDashboard(member, memberReports) {
  const allItems   = memberReports.flatMap(r => r.items);
  const totalHours = memberReports.reduce((s, r) => s + (r.totalHours || 0), 0);

  // 일평균 계산
  let avgHours = 0;
  if (workMode === 'daily') {
    avgHours = totalHours;
  } else if (workMode === 'weekly') {
    const workDays = new Set(memberReports.map(r => r.date)).size || 1;
    avgHours = totalHours / workDays;
  } else if (workMode === 'monthly') {
    const workDays = new Set(memberReports.map(r => r.date)).size || 1;
    avgHours = totalHours / workDays;
  }

  // 카테고리별 시간 합산
  const catMap = {};
  allItems.forEach(i => {
    const cat = i.category || '기타';
    catMap[cat] = (catMap[cat] || 0) + (i.hours || 0);
  });
  const catTotal = Object.values(catMap).reduce((s, v) => s + v, 0) || 1;
  const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  // 카테고리 색상 맵
  const catColorMap = {
    '영업': '#6C5CE7',
    '기획': '#00B894',
    '운영': '#FDCB6E',
    '행정': '#74B9FF',
    '미팅': '#E17055',
  };

  const catBarsHTML = sortedCats.map(([cat, hours]) => {
    const pct   = Math.round(hours / catTotal * 100);
    const color = catColorMap[cat] || '#888';
    return `
      <div class="mini-bar-row">
        <div class="mini-bar-label">${translateCategory(cat)}</div>
        <div class="mini-bar-track">
          <div class="mini-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="mini-bar-pct">${pct}%</div>
      </div>`;
  }).join('');

  // 상태별 건수
  const doneCount = allItems.filter(i => i.status === 'done').length;
  const wipCount  = allItems.filter(i => i.status === 'wip').length;
  const todoCount = allItems.filter(i => i.status === 'todo').length;
  const totalItems = allItems.length || 1;

  const statusHTML = `
    <div class="mini-stat-row">
      <span class="mini-stat-icon">✅</span>
      <span class="mini-stat-label">${t('done')}</span>
      <span class="mini-stat-count">${doneCount}건</span>
      <span class="mini-stat-pct">(${Math.round(doneCount/totalItems*100)}%)</span>
    </div>
    <div class="mini-stat-row">
      <span class="mini-stat-icon">🔄</span>
      <span class="mini-stat-label">${t('inProgress')}</span>
      <span class="mini-stat-count">${wipCount}건</span>
      <span class="mini-stat-pct">(${Math.round(wipCount/totalItems*100)}%)</span>
    </div>
    <div class="mini-stat-row">
      <span class="mini-stat-icon">📅</span>
      <span class="mini-stat-label">${t('todo')}</span>
      <span class="mini-stat-count">${todoCount}건</span>
      <span class="mini-stat-pct">(${Math.round(todoCount/totalItems*100)}%)</span>
    </div>`;

  // 요일별 업무시간 (주간/일일만 의미있음)
  let weeklyBarsHTML = '';
  if (workMode === 'weekly' || workMode === 'daily') {
    const DAYS_SHORT = getDaysShort();
    const dayHours = {};
    const dayDateMap = {}; // dayIdx → dateStr
    memberReports.forEach(r => {
      const d = new Date(r.date);
      const idx = d.getDay() - 1; // 0=mon
      if (idx >= 0 && idx <= 4) {
        dayHours[idx] = (dayHours[idx] || 0) + (r.totalHours || 0);
        dayDateMap[idx] = r.date; // 가장 최근 날짜가 저장됨
      }
    });
    const maxH = Math.max(...Object.values(dayHours), 1);
    const memberId = member.id;

    weeklyBarsHTML = `
      <div class="mini-section-title">요일별 업무시간 <span class="mini-click-hint">(클릭하면 업무 내용 보기)</span></div>
      <div class="mini-weekly-bars" data-member-id="${memberId}">
        ${DAYS_SHORT.map((d, i) => {
          const h   = dayHours[i] || 0;
          const pct = Math.round(h / maxH * 100);
          const hasData = h > 0;
          return `
            <div class="mini-weekly-col ${hasData ? 'mini-weekly-clickable' : ''}" data-day="${i}" data-member-id="${memberId}">
              <div class="mini-weekly-bar-wrap">
                <div class="mini-weekly-bar-fill" style="height:${pct}%;background:${member.color}cc"></div>
              </div>
              <div class="mini-weekly-label">${d}</div>
              <div class="mini-weekly-val">${h > 0 ? h.toFixed(0)+'h' : '-'}</div>
            </div>`;
        }).join('')}
      </div>
      <div class="mini-weekly-detail" id="mini-detail-${memberId}" style="display:none"></div>`;
  } else if (workMode === 'monthly') {
    // 월간 모드: 주차별 요약
    const weekMap = {};
    memberReports.forEach(r => {
      const d  = new Date(r.date);
      const wk = getWeekOfMonth(d);
      weekMap[wk] = (weekMap[wk] || 0) + (r.totalHours || 0);
    });
    const maxW = Math.max(...Object.values(weekMap), 1);
    const weekKeys = Object.keys(weekMap).sort();

    weeklyBarsHTML = `
      <div class="mini-section-title">주차별 업무시간</div>
      <div class="mini-weekly-bars">
        ${weekKeys.map(wk => {
          const h   = weekMap[wk] || 0;
          const pct = Math.round(h / maxW * 100);
          return `
            <div class="mini-weekly-col">
              <div class="mini-weekly-bar-wrap">
                <div class="mini-weekly-bar-fill" style="height:${pct}%;background:${member.color}cc"></div>
              </div>
              <div class="mini-weekly-label">${wk}주</div>
              <div class="mini-weekly-val">${h > 0 ? h.toFixed(0)+'h' : '-'}</div>
            </div>`;
        }).join('')}
      </div>`;
  }

  // 전주 대비 (주간 모드만)
  let prevCompareHTML = '';
  if (workMode === 'weekly' && allData) {
    const now = new Date();
    const prevBase = new Date(now);
    prevBase.setDate(prevBase.getDate() + (weeklyOffset - 1) * 7);
    const prevMon = getMonday(prevBase);
    const prevSun = new Date(prevMon); prevSun.setDate(prevMon.getDate() + 6);

    const prevHours = (allData.reports || [])
      .filter(r => r.memberId === member.id)
      .filter(r => { const d = new Date(r.date); return d >= prevMon && d <= prevSun; })
      .reduce((s, r) => s + (r.totalHours || 0), 0);

    const diff = totalHours - prevHours;
    if (prevHours > 0 || diff !== 0) {
      const sign  = diff >= 0 ? '+' : '';
      const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '–';
      const color = diff > 0 ? '#00B894' : diff < 0 ? '#E17055' : '#888';
      prevCompareHTML = `
        <div class="mini-compare" style="color:${color}">
          전주 대비: <strong>${sign}${diff.toFixed(1)}h</strong> ${arrow}
        </div>`;
    }
  }

  // 기간 레이블
  const periodLabel = workMode === 'daily' ? '당일' : workMode === 'weekly' ? '이번주' : '이번달';

  const dashEl = document.createElement('div');
  dashEl.className = 'member-mini-dashboard';
  dashEl.innerHTML = `
    <div class="mini-dash-header" style="border-color:${member.color}33">
      <span class="mini-dash-title">📊 ${member.name} · 업무 현황</span>
    </div>
    <div class="mini-dash-summary">
      <div class="mini-summary-chip" style="color:${member.color};background:${member.color}11;border-color:${member.color}33">
        <span class="mini-summary-label">${periodLabel}</span>
        <span class="mini-summary-val">${totalHours.toFixed(1)}h</span>
      </div>
      <div class="mini-summary-chip" style="color:#718096;background:#f7f9fc;border-color:#e0e4e8">
        <span class="mini-summary-label">일평균</span>
        <span class="mini-summary-val">${avgHours.toFixed(1)}h</span>
      </div>
    </div>

    ${sortedCats.length > 0 ? `
    <div class="mini-section-title">카테고리별 업무분포</div>
    <div class="mini-bars">${catBarsHTML}</div>
    ` : ''}

    <div class="mini-section-title">상태별 분포</div>
    <div class="mini-stats">${statusHTML}</div>

    ${weeklyBarsHTML}
    ${prevCompareHTML}
  `;

  // 요일 바 클릭 이벤트 (주간/일일 모드에서만)
  if (workMode === 'weekly' || workMode === 'daily') {
    const cols = dashEl.querySelectorAll('.mini-weekly-clickable');
    cols.forEach(col => {
      col.addEventListener('click', () => {
        const dayIdx   = parseInt(col.dataset.day, 10);
        const memberId = col.dataset.memberId;
        const detailEl = dashEl.querySelector(`#mini-detail-${memberId}`);
        if (!detailEl) return;

        // 이미 같은 날 클릭 → 접기
        if (col.classList.contains('mini-weekly-active')) {
          col.classList.remove('mini-weekly-active');
          detailEl.style.display = 'none';
          detailEl.innerHTML = '';
          return;
        }

        // 다른 날 클릭 → 기존 active 해제 후 새로 표시
        cols.forEach(c => c.classList.remove('mini-weekly-active'));
        col.classList.add('mini-weekly-active');

        // 해당 요일 보고서 찾기
        const targetReports = memberReports.filter(r => {
          const d   = new Date(r.date);
          const idx = d.getDay() - 1;
          return idx === dayIdx;
        });

        if (targetReports.length === 0) {
          detailEl.style.display = 'none';
          return;
        }

        // 날짜 포맷
        const WEEKDAYS_SHORT = ['월', '화', '수', '목', '금'];
        const dateStr  = targetReports[0].date;
        const dateObj  = new Date(dateStr);
        const mStr     = `${dateObj.getMonth()+1}월 ${dateObj.getDate()}일`;
        const dayLabel = WEEKDAYS_SHORT[dayIdx] || '';
        const dayTotalH = targetReports.reduce((s, r) => s + (r.totalHours || 0), 0);

        const allDayItems = targetReports.flatMap(r => r.items);
        const itemsHTML = allDayItems.map(item => `
          <div class="mini-detail-item">
            <span class="mini-detail-status">${statusIcon(item.status)}</span>
            <span class="mini-detail-task">${item.task}</span>
            <span class="mini-detail-hours">(${item.hours}h)</span>
          </div>
        `).join('');

        detailEl.innerHTML = `
          <div class="mini-detail-header">▼ ${mStr}(${dayLabel}) 업무 내용</div>
          <div class="mini-detail-items">${itemsHTML}</div>
          <div class="mini-detail-total">업무시간: ${dayTotalH.toFixed(1)}h</div>
        `;
        detailEl.style.display = 'block';
      });
    });
  }

  return dashEl;
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
    container.innerHTML = `<div class="no-issues">✅ ${t('noIssues')}</div>`;
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
  const today           = new Date().toISOString().split('T')[0];
  const todaySubmitters = new Set(reports.filter(r => r.date === today).map(r => r.memberId));
  const missing         = team.filter(m => !todaySubmitters.has(m.id));
  if (missing.length === 0) {
    container.innerHTML = `<div class="all-submitted">✅ ${t('allSubmitted')}</div>`;
    return;
  }
  missing.forEach(m => {
    const el     = document.createElement('div');
    el.className = 'missing-item';
    el.innerHTML = `
      <div class="missing-avatar" style="background:${m.color}">${m.name[0]}</div>
      <div class="missing-info"><h4>${m.name}</h4><span>${translateRole(m.role)}</span></div>
      <span class="missing-badge">${t('notSubmitted')}</span>
    `;
    container.appendChild(el);
  });
}

/* ── WORK MODE TABS ── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.work-mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.work-mode-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      workMode = btn.dataset.mode;
      render();
    });
  });

  const datePicker = document.getElementById('daily-date-picker');
  if (datePicker) {
    const todayStr = new Date().toISOString().split('T')[0];
    datePicker.value = todayStr;
    datePicker.addEventListener('change', () => {
      dailyDate = new Date(datePicker.value + 'T00:00:00');
      render();
    });
  }

  const weekPrev = document.getElementById('weekly-prev');
  const weekNext = document.getElementById('weekly-next');
  if (weekPrev) weekPrev.addEventListener('click', () => { weeklyOffset--;  render(); });
  if (weekNext) weekNext.addEventListener('click', () => { weeklyOffset++;  render(); });

  const monthPrev = document.getElementById('monthly-prev');
  const monthNext = document.getElementById('monthly-next');
  if (monthPrev) monthPrev.addEventListener('click', () => { monthlyOffset--; render(); });
  if (monthNext) monthNext.addEventListener('click', () => { monthlyOffset++; render(); });
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

/* ── LANG TOGGLE ── */
function updateLangButtons() {
  const btnKo = document.getElementById('btn-ko');
  const btnEn = document.getElementById('btn-en');
  if (!btnKo || !btnEn) return;
  if (i18n.lang === 'ko') {
    btnKo.classList.add('active');
    btnEn.classList.remove('active');
  } else {
    btnEn.classList.add('active');
    btnKo.classList.remove('active');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateLangButtons();

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newLang = btn.dataset.lang;
      if (newLang === i18n.lang) return;
      i18n.setLang(newLang);
      document.documentElement.setAttribute('lang', newLang);
      rerenderAll();
    });
  });
});

/* ════════════════════════════════════════
   SCHEDULE VIEW
   ════════════════════════════════════════ */
function renderScheduleView() {
  if (!scheduleData) return;
  renderUnifiedCalendar();
  renderScheduleCards();
}

function getMemberColor(name) {
  const team = getTeam();
  const m = team.find(t => t.name === name);
  return m ? m.color : '#888';
}

function fmtDate(d) { return `${d.getMonth()+1}/${d.getDate()}`; }

function fmtFullDate(dateStr) {
  const d = new Date(dateStr);
  const WEEKDAYS = getWeekdaysLong();
  if (i18n.lang === 'en') {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
  }
  return `${d.getMonth()+1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

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
      title:     translateLeaveType(lv.type),
      _rawType:  lv.type,
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

  (scheduleData.common || []).forEach(cm => {
    items.push({
      type:      'common',
      date:      cm.date,
      endDate:   cm.date,
      member:    null,
      memberId:  null,
      title:     cm.title,
      location:  cm.location,
      startTime: cm.startTime,
      endTime:   cm.endTime,
      status:    cm.status,
    });
  });

  return items.sort((a, b) => a.date.localeCompare(b.date));
}

/* ── 통합 캘린더 ── */
function renderUnifiedCalendar() {
  const container = document.getElementById('unifiedCalendar');
  const labelEl   = document.getElementById('schedule-month-label');
  if (!container) return;

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  if (labelEl) {
    if (i18n.lang === 'en') {
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      labelEl.textContent = `${months[month]} ${year}`;
    } else {
      labelEl.textContent = `${year}년 ${month+1}월`;
    }
  }

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
  const weekdays    = getWeekdaysLong();
  const TYPE_COLORS = getTypeColors();

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

    const MAX_SHOW = 3;
    const shown    = items.slice(0, MAX_SHOW);
    const extra    = items.length - MAX_SHOW;

    const eventItems = shown.map(item => {
      const c     = TYPE_COLORS[item.type] || TYPE_COLORS.general;
      const label = c.label;
      const name  = item.member || '';
      const title = item.title || '';
      const isCommon = item.type === 'common';
      const text  = isCommon ? title : (name ? `${name} • ${title}` : title);
      const prefix = isCommon ? `<span class="ucal-event-common-badge">${t('allTeam')}</span>` : '';
      return `<div class="ucal-event-item ucal-event-common-item" style="border-left:3px solid ${c.dot};background:${c.bg}" title="[${label}] ${text}">
        <span class="ucal-event-type">${label}</span>${prefix}<span class="ucal-event-text">${text}</span>
      </div>`;
    }).join('');

    const moreHtml = extra > 0
      ? `<div class="ucal-event-more">+${extra}${t('moreEvents')}</div>`
      : '';

    html += `<div class="${cls}" data-date="${dateStr}" onclick="showDayDetail('${dateStr}')">
      <div class="ucal-day-num">${d}</div>
      ${eventItems}${moreHtml}
    </div>`;
  }

  html += '</div>';

  html += `<div class="ucal-legend">
    ${Object.entries(TYPE_COLORS).map(([tp, c]) =>
      `<div class="ucal-legend-item">
        <div class="ucal-dot" style="background:${c.dot}"></div>
        <span>${c.label}</span>
      </div>`
    ).join('')}
  </div>`;

  container.innerHTML = html;

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
  const popup  = document.getElementById('calDetailPopup');
  const dateEl = document.getElementById('calDetailDate');
  const listEl = document.getElementById('calDetailList');
  if (!popup) return;

  const TYPE_COLORS = getTypeColors();
  const items = getAllScheduleItems().filter(item => {
    const start  = new Date(item.date);
    const end    = new Date(item.endDate || item.date);
    const target = new Date(dateStr);
    return target >= start && target <= end;
  });

  if (items.length === 0) { popup.style.display = 'none'; return; }

  dateEl.textContent = fmtFullDate(dateStr);
  // common 일정 먼저, 개인 일정 나중에
  const sortedItems = [...items].sort((a, b) => {
    if (a.type === 'common' && b.type !== 'common') return -1;
    if (a.type !== 'common' && b.type === 'common') return 1;
    return 0;
  });
  listEl.innerHTML   = sortedItems.map(item => {
    const tc      = TYPE_COLORS[item.type] || TYPE_COLORS.general;
    const isCommon = item.type === 'common';
    const color   = isCommon ? '#6C5CE7' : getMemberColor(item.member);
    const time    = item.startTime ? `${item.startTime}${item.endTime ? ' ~ ' + item.endTime : ''}` : '';
    const memberChip = isCommon
      ? `<span class="member-chip common-member-chip" style="color:#6C5CE7">👥 ${t('commonSchedule')}</span>`
      : `<span class="member-chip" style="color:${color}">● ${item.member}</span>`;
    return `<div class="cal-detail-item ${isCommon ? 'cal-detail-common' : ''}">
      <span class="sched-type-badge" style="background:${tc.bg};color:${tc.text}">${tc.label}</span>
      <div class="cal-detail-content">
        <div class="cal-detail-title">${item.title}</div>
        <div class="cal-detail-meta">
          ${memberChip}
          ${time ? `<span>⏰ ${time}</span>` : ''}
          ${item.location ? `<span>📍 ${item.location}</span>` : ''}
        </div>
      </div>
      <span class="status-badge ${item.status}">${getScheduleStatusLabel(item.status)}</span>
    </div>`;
  }).join('');

  popup.style.display = 'block';
}

/* ── 일정 카드 목록 ── */
function renderScheduleCards() {
  const container = document.getElementById('scheduleCardsList');
  if (!container) return;
  container.innerHTML = '';

  const TYPE_COLORS = getTypeColors();
  const allItems = getAllScheduleItems();

  // common: 항상 표시, personal: 팀원 필터 적용
  const commonItems = allItems.filter(i => i.type === 'common');
  let personalItems = allItems.filter(i => i.type !== 'common');
  if (selectedMember !== 'all') {
    personalItems = personalItems.filter(i => i.member === selectedMember);
  }

  if (commonItems.length === 0 && personalItems.length === 0) {
    const who = selectedMember === 'all' ? '' : selectedMember + ' ';
    container.innerHTML = `<div class="no-schedule">📭 ${who}${t('noSchedule')}</div>`;
    return;
  }

  function buildGroupedCards(items, isCommon) {
    const groupMap   = {};
    const groupOrder = [];

    items.forEach(item => {
      const key = isCommon ? `${item.date}___common` : `${item.date}___${item.member}`;
      if (!groupMap[key]) {
        groupMap[key] = { date: item.date, member: item.member, items: [], isCommon };
        groupOrder.push(key);
      }
      groupMap[key].items.push(item);
    });

    groupOrder.sort((a, b) => {
      const ga = groupMap[a];
      const gb = groupMap[b];
      const dateCmp = ga.date.localeCompare(gb.date);
      if (dateCmp !== 0) return dateCmp;
      if (!isCommon) return (ga.member || '').localeCompare(gb.member || '');
      return 0;
    });

    return groupOrder.map(key => {
      const group   = groupMap[key];
      const color   = isCommon ? '#6C5CE7' : getMemberColor(group.member);
      const dateStr = fmtFullDate(group.date);

      group.items.sort((a, b) => {
        const ta = a.startTime || 'ZZ:ZZ';
        const tb = b.startTime || 'ZZ:ZZ';
        return ta.localeCompare(tb);
      });

      const itemsHtml = group.items.map(item => {
        const tc = TYPE_COLORS[item.type] || TYPE_COLORS.general;
        const badge = item.status === 'confirmed' || item.status === 'approved' ? 'confirmed' :
                      item.status === 'pending' ? 'pending' : 'cancelled';

        let timeStr = '';
        if (item.startTime) {
          timeStr = item.endTime ? `${item.startTime}~${item.endTime}` : item.startTime;
        } else if (item.days) {
          timeStr = i18n.lang === 'en' ? `${item.days}d` : `${item.days}일`;
        }

        const titleText = item.title || '';
        const locText   = item.location ? ` · ${item.location}` : '';
        const noteText  = item.note ? ` · ${item.note}` : '';
        const mainText  = `${titleText}${locText}${noteText}`;

        return `
          <div class="sched-group-item" style="border-left:3px solid ${tc.dot || tc.bg}">
            <span class="sched-type-badge sched-type-badge-sm" style="background:${tc.bg};color:${tc.text}">${tc.label}</span>
            ${timeStr ? `<span class="sched-group-time">${timeStr}</span>` : ''}
            <span class="sched-group-title">${mainText}</span>
            <span class="status-badge ${badge} sched-status-sm">${getScheduleStatusLabel(item.status)}</span>
          </div>`;
      }).join('');

      if (isCommon) {
        const allTeamBadge = i18n.lang === 'en' ? 'All Team' : '전체';
        return `
          <div class="sched-card sched-card-grouped sched-card-common">
            <div class="sched-card-top">
              <span class="sched-date-text">📅 ${dateStr}</span>
            </div>
            <div class="sched-member-chip">
              <div class="sched-member-dot" style="background:#6C5CE7"></div>
              <span style="color:#6C5CE7;font-weight:700;font-size:13px">👥 ${t('commonSchedule')}</span>
              <span class="sched-all-team-badge">${allTeamBadge}</span>
            </div>
            <div class="sched-group-divider"></div>
            <div class="sched-group-items">
              ${itemsHtml}
            </div>
          </div>`;
      } else {
        return `
          <div class="sched-card sched-card-grouped" style="--member-color:${color}">
            <div class="sched-card-top">
              <span class="sched-date-text">📅 ${dateStr}</span>
            </div>
            <div class="sched-member-chip">
              <div class="sched-member-dot" style="background:${color}"></div>
              <span style="color:${color};font-weight:700;font-size:13px">👤 ${group.member}</span>
            </div>
            <div class="sched-group-divider"></div>
            <div class="sched-group-items">
              ${itemsHtml}
            </div>
          </div>`;
      }
    }).join('');
  }

  // common 섹션 우측에 표시
  container.classList.toggle('has-common', commonItems.length > 0);
  if (commonItems.length > 0) {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'sched-common-section';
    sectionEl.innerHTML = `
      <div class="sched-section-label sched-section-label-common">
        <span class="sched-section-dot" style="background:#6C5CE7"></span>
        ${t('commonSchedule')}
      </div>
      ${buildGroupedCards(commonItems, true)}
    `;
    container.appendChild(sectionEl);
  }

  if (personalItems.length > 0) {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'sched-personal-section';
    sectionEl.innerHTML = buildGroupedCards(personalItems, false);
    container.appendChild(sectionEl);
  }
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

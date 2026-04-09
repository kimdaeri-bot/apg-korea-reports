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

function getMonday(d) {
  const date = new Date(d);
  const day  = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// 주차 번호 계산 (ISO-like, 월 기준)
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

// 레거시 — 일정 뷰에서도 사용
function getFilteredReportsLegacy() {
  if (!allData) return [];
  return allData.reports;
}

/* ── RENDER (업무현황) ── */
function render() {
  updatePeriodUI();
  const reports = getFilteredReports();
  renderStats(reports);
  renderCharts(reports);
  renderMemberCards(reports);
  renderIssues(reports);
  renderMissing(reports);
}

/* ── 기간 UI 업데이트 ── */
function updatePeriodUI() {
  const now = new Date();

  // 섹션 타이틀
  const titleEl = document.getElementById('charts-section-title');
  const trendTitle = document.getElementById('trend-chart-title');

  if (workMode === 'daily') {
    if (titleEl) titleEl.textContent = '📊 일일 현황';
    if (trendTitle) trendTitle.textContent = '팀원별 업무시간';
    // 일일 네비 표시
    document.getElementById('daily-nav').style.display = 'flex';
    document.getElementById('weekly-nav').style.display = 'none';
    document.getElementById('monthly-nav').style.display = 'none';
  } else if (workMode === 'weekly') {
    if (titleEl) titleEl.textContent = '📊 주간 현황';
    if (trendTitle) trendTitle.textContent = '주간 업무시간 추이';
    document.getElementById('daily-nav').style.display = 'none';
    document.getElementById('weekly-nav').style.display = 'flex';
    document.getElementById('monthly-nav').style.display = 'none';
    // 주간 라벨
    const base = new Date(now);
    base.setDate(base.getDate() + weeklyOffset * 7);
    const mon = getMonday(base);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 4); // 금요일
    const weekNum = getWeekOfMonth(mon);
    const label = `${mon.getFullYear()}년 ${mon.getMonth()+1}월 ${weekNum}주차 (${mon.getMonth()+1}/${mon.getDate()}~${sun.getMonth()+1}/${sun.getDate()})`;
    document.getElementById('weekly-label').textContent = label;
  } else if (workMode === 'monthly') {
    if (titleEl) titleEl.textContent = '📊 월간 현황';
    if (trendTitle) trendTitle.textContent = '일별 업무시간 추이';
    document.getElementById('daily-nav').style.display = 'none';
    document.getElementById('weekly-nav').style.display = 'none';
    document.getElementById('monthly-nav').style.display = 'flex';
    // 월간 라벨
    const base = new Date(now.getFullYear(), now.getMonth() + monthlyOffset, 1);
    document.getElementById('monthly-label').textContent = `${base.getFullYear()}년 ${base.getMonth()+1}월`;
  }
}

/* ── STATS ── */
function renderStats(reports) {
  const totalHours  = reports.reduce((s, r) => s + (r.totalHours || 0), 0);
  const totalTasks  = reports.reduce((s, r) => s + r.items.length, 0);
  const doneTasks   = reports.reduce((s, r) => s + r.items.filter(i => i.status === 'done').length, 0);
  const totalIssues = reports.reduce((s, r) => s + (r.issues || []).length, 0);
  const submitters  = new Set(reports.map(r => r.memberId)).size;

  // 월간 모드: 일평균 표시
  if (workMode === 'monthly') {
    const now  = new Date();
    const base = new Date(now.getFullYear(), now.getMonth() + monthlyOffset, 1);
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    // 실제 데이터 있는 날짜 수
    const workDays = new Set(reports.map(r => r.date)).size || 1;
    const avgHours = workDays > 0 ? (totalHours / workDays) : 0;
    document.getElementById('stat-hours').textContent      = totalHours.toFixed(1);
    document.getElementById('stat-submitters').textContent = `일평균 ${avgHours.toFixed(1)}h`;
  } else {
    document.getElementById('stat-hours').textContent      = totalHours.toFixed(1);
    document.getElementById('stat-submitters').textContent = `${submitters}명 제출`;
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

  // 공통: 팀원별 시간 바 차트
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
  });

  // 공통: 카테고리, 상태
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

  // 4번째 차트: 모드별 분기
  const now = new Date();

  if (workMode === 'daily') {
    // 일일: 팀원별 당일 시간 (바차트 재활용, 이미 위에서 렌더됨)
    // 4번째 차트: 카테고리별 업무시간 (라인이 아닌 바)
    renderDailyBarChart(reports, colorMap);
  } else if (workMode === 'weekly') {
    // 주간: 4주 추이 라인 차트
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
          weekLabels.push(w === 0 ? '이번주' : w === 1 ? '저번주' : w + '주전');
        }
      }
      weekDatasets.push(ds);
    });
    renderWeeklyTrendChart({ labels: weekLabels, datasets: weekDatasets });
  } else if (workMode === 'monthly') {
    // 월간: 일별 업무시간 라인 차트
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
        label: '일별 업무시간',
        borderColor: '#6C5CE7',
        backgroundColor: 'rgba(108,92,231,0.15)',
        data: dateKeys.map(k => dayHoursMap[k]),
        fill: true,
      }]
    });
  }
}

/* 일일 모드 4번째 차트: 카테고리별 시간 바 */
function renderDailyBarChart(reports, colorMap) {
  const catMap = {};
  reports.forEach(r => r.items.forEach(i => {
    catMap[i.category] = (catMap[i.category] || 0) + i.hours;
  }));
  const CAT_COLORS = {
    '영업': '#6C5CE7', '기획': '#00B894', '운영': '#FDCB6E', '행정': '#74B9FF', '미팅': '#E17055',
  };
  const labels = Object.keys(catMap);
  renderWeeklyTrendChart({
    labels,
    datasets: [{
      label: '업무시간',
      borderColor: labels.map(l => CAT_COLORS[l] || '#888'),
      backgroundColor: labels.map(l => (CAT_COLORS[l] || '#888') + 'aa'),
      data: labels.map(l => catMap[l]),
      type: 'bar',
    }]
  });
}

/* ── MEMBER CARDS ── */
function renderMemberCards(reports) {
  const container = document.getElementById('memberCards');
  container.innerHTML = '';
  const team = getTeam();

  team.forEach(member => {
    const memberReports = reports.filter(r => r.memberId === member.id);
    if (memberReports.length === 0) return;

    const totalHours    = memberReports.reduce((s, r) => s + (r.totalHours || 0), 0);
    const allItems      = memberReports.flatMap(r => r.items);
    const workHoursLabel = formatWorkHours(member);

    // 타임라인 섹션 — 모드별 분기
    let timelineHTML = '';

    if (workMode === 'daily') {
      // 일일: 단순 업무 목록 + 총시간
      timelineHTML = `
        <div class="timeline">
          <div class="timeline-title">당일 업무</div>
          <div style="font-size:13px;color:var(--text-muted);padding:6px 0;">총 ${totalHours.toFixed(1)}시간</div>
        </div>`;
    } else if (workMode === 'weekly') {
      // 주간: 월~금 바 차트
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
        </div>`;
    } else if (workMode === 'monthly') {
      // 월간: 주차별 요약
      const now  = new Date();
      const base = new Date(now.getFullYear(), now.getMonth() + monthlyOffset, 1);
      const weekSummary = {};
      memberReports.forEach(r => {
        const d = new Date(r.date);
        const wk = getWeekOfMonth(d);
        weekSummary[wk] = (weekSummary[wk] || 0) + (r.totalHours || 0);
      });
      const weekRows = Object.keys(weekSummary).sort().map(wk =>
        `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid #f0f0f0;">
          <span style="color:var(--text-muted)">${wk}주차</span>
          <span style="font-weight:600;color:${member.color}">${weekSummary[wk].toFixed(1)}h</span>
        </div>`
      ).join('');
      timelineHTML = `
        <div class="timeline">
          <div class="timeline-title">주차별 요약</div>
          <div style="margin-top:6px">${weekRows || '<div style="color:var(--text-muted);font-size:12px">데이터 없음</div>'}</div>
        </div>`;
    }

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
      ${timelineHTML}
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

/* ── WORK MODE TABS (일일/주간/월간) ── */
document.addEventListener('DOMContentLoaded', () => {
  // 모드 탭 클릭
  document.querySelectorAll('.work-mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.work-mode-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      workMode = btn.dataset.mode;
      render();
    });
  });

  // 일일: 날짜 피커 기본값 및 이벤트
  const datePicker = document.getElementById('daily-date-picker');
  if (datePicker) {
    const todayStr = new Date().toISOString().split('T')[0];
    datePicker.value = todayStr;
    datePicker.addEventListener('change', () => {
      dailyDate = new Date(datePicker.value + 'T00:00:00');
      render();
    });
  }

  // 주간: 이전/다음 버튼
  const weekPrev = document.getElementById('weekly-prev');
  const weekNext = document.getElementById('weekly-next');
  if (weekPrev) weekPrev.addEventListener('click', () => { weeklyOffset--; render(); });
  if (weekNext) weekNext.addEventListener('click', () => { weeklyOffset++; render(); });

  // 월간: 이전/다음 버튼
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

  // 날짜 + 멤버 기준 그룹핑
  // groupMap: { "2025-04-16___정경준": [item, item, ...] }
  const groupMap = {};
  const groupOrder = []; // 순서 보존 (날짜 오름차순, 같은 날짜 내 멤버명 오름차순)

  items.forEach(item => {
    const key = `${item.date}___${item.member}`;
    if (!groupMap[key]) {
      groupMap[key] = { date: item.date, member: item.member, items: [] };
      groupOrder.push(key);
    }
    groupMap[key].items.push(item);
  });

  // 날짜 오름차순 → 같은 날짜 내 멤버명 오름차순
  groupOrder.sort((a, b) => {
    const ga = groupMap[a];
    const gb = groupMap[b];
    const dateCmp = ga.date.localeCompare(gb.date);
    if (dateCmp !== 0) return dateCmp;
    return ga.member.localeCompare(gb.member);
  });

  groupOrder.forEach(key => {
    const group = groupMap[key];
    const color = getMemberColor(group.member);
    const dateStr = fmtFullDate(group.date);

    // 그룹 내 일정을 시간 오름차순 정렬
    // 시간 없는 항목(휴가 등)은 뒤로
    group.items.sort((a, b) => {
      const ta = a.startTime || 'ZZ:ZZ';
      const tb = b.startTime || 'ZZ:ZZ';
      return ta.localeCompare(tb);
    });

    // 일정 목록 HTML
    const itemsHtml = group.items.map(item => {
      const tc = TYPE_COLORS[item.type] || TYPE_COLORS.general;
      const badge = item.status === 'confirmed' || item.status === 'approved' ? 'confirmed' :
                    item.status === 'pending' ? 'pending' : 'cancelled';

      let timeStr = '';
      if (item.startTime) {
        timeStr = item.endTime ? `${item.startTime}~${item.endTime}` : item.startTime;
      } else if (item.days) {
        timeStr = `${item.days}일`;
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
          <span class="status-badge ${badge} sched-status-sm">${STATUS_LABEL[item.status]}</span>
        </div>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'sched-card sched-card-grouped';
    card.style.setProperty('--member-color', color);
    card.innerHTML = `
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

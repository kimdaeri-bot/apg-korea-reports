/* i18n.js — APG Korea 다국어 지원 (ko/en) */

const i18n = {
  _lang: localStorage.getItem('apg-lang') || 'ko',

  translations: {
    ko: {
      /* nav */
      nav_work: '업무현황',
      nav_schedule: '일정관리',
      /* period tabs */
      daily: '일일',
      weekly: '주간',
      monthly: '월간',
      /* stat labels */
      totalHours: '총 업무시간',
      totalTasksLabel: '총 업무 건수',
      taskCount: '업무건수',
      completionRate: '완료율',
      issuesLabel: '이슈',
      issueCount: '이슈건수',
      submitRate: '보고 제출률',
      avgHours: '일평균',
      workBalance: '업무 밸런스',
      leaveRate: '연차 사용률',
      /* stat subs */
      hours: '시간',
      hoursShort: 'h',
      completionRateSub: '완료 비율',
      issuesSub: '건 접수',
      /* status */
      done: '완료',
      inProgress: '진행중',
      todo: '예정',
      /* priority */
      high: '높음',
      normal: '보통',
      low: '낮음',
      /* schedule status */
      confirmed: '확정',
      pending: '대기',
      cancelled: '취소',
      approved: '승인',
      rejected: '반려',
      /* schedule types */
      fieldwork: '외근',
      leave: '휴가',
      general: '기타',
      /* leave types */
      annual: '연차',
      halfDayAM: '반차(오전)',
      halfDayPM: '반차(오후)',
      special: '특휴',
      sick: '병가',
      /* section headings */
      summaryReport: '종합 요약',
      memberCards: '팀원별 상세',
      memberCardsTitle: '팀원별 상세',
      issueBoard: '이슈 보드',
      missingReport: '미제출 현황',
      dailySummary: '일일 요약',
      weeklySummary: '주간 요약',
      monthlySummary: '월간 보고',
      keyAchievements: '핵심 성과',
      pendingIssues: '미완료/이슈',
      /* chart titles */
      memberHoursChart: '팀원별 업무시간',
      categoryChart: '업무 카테고리 분포',
      statusChart: '업무 상태 분포',
      trend: '트렌드',
      categoryBreakdown: '카테고리별 비중',
      weeklyWorkload: '주차별 업무량',
      memberContribution: '팀원별 기여도',
      /* period status titles */
      dailyStatusTitle: '일일 현황',
      weeklyStatusTitle: '주간 현황',
      monthlyStatusTitle: '월간 현황',
      teamMemberHours: '팀원별 업무시간',
      weeklyTrendTitle: '주간 업무시간 추이',
      dailyTrendTitle: '일별 업무시간 추이',
      /* timeline */
      dailyWorkHours: '일별 업무시간',
      weekSummaryTitle: '주차별 요약',
      weekUnit: '주차',
      /* misc */
      dashboardTitle: '업무대시보드',
      workHoursBadgeText: '근무시간',
      workTime: '근무시간',
      all: '전체',
      noReports: '해당 기간의 보고서가 없습니다',
      noData: '데이터 없음',
      noPeriodData: '해당 기간 데이터 없음',
      noIssues: '이슈 없음',
      allSubmitted: '전원 제출 완료',
      notSubmitted: '미제출',
      membersSubmitted: '명 제출',
      dailyAvgPrefix: '일평균',
      teamSummaryTitle: '팀원 업무 요약',
      /* weekdays */
      sun: '일', mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토',
      /* week nav labels */
      thisWeek: '이번주',
      lastWeek: '저번주',
      weeksAgoSuffix: '주전',
      /* navigation */
      prevWeek: '이전주',
      nextWeek: '다음주',
      prevMonth: '이전달',
      nextMonth: '다음달',
      weekOf: '주차',
      comparedToPrev: '전주 대비',
      increase: '증가',
      decrease: '감소',
      noSubmitYet: '아직 보고가 없습니다',
      overdue: '미제출',
      allDone: '전원 제출',
      /* schedule */
      calendarTitle: '월별 캘린더',
      scheduleList: '일정 목록',
      scheduleGuide: '일정 등록 가이드',
      guideDesc: '카카오톡 채팅에 아래 형식으로 입력하면 자동으로 일정이 등록됩니다.',
      filterMember: '팀원 필터',
      allMembers: '전체 팀원',
      noSchedule: '일정이 없습니다',
      /* unit suffix for schedules */
      moreEvents: '건 더보기',
      /* categories */
      categories: {
        sales: '영업', planning: '기획', ops: '운영', admin: '행정', meeting: '미팅'
      },
      /* roles */
      roles: {
        ceo: '대표', gm: '실장', manager: '차장', director: '부장'
      },
    },

    en: {
      /* nav */
      nav_work: 'Work Status',
      nav_schedule: 'Schedule',
      /* period tabs */
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      /* stat labels */
      totalHours: 'Total Hours',
      totalTasksLabel: 'Total Tasks',
      taskCount: 'Tasks',
      completionRate: 'Completion',
      issuesLabel: 'Issues',
      issueCount: 'Issues',
      submitRate: 'Submit Rate',
      avgHours: 'Daily Avg',
      workBalance: 'Work Balance',
      leaveRate: 'Leave Used',
      /* stat subs */
      hours: 'hours',
      hoursShort: 'h',
      completionRateSub: 'completion rate',
      issuesSub: 'logged',
      /* status */
      done: 'Done',
      inProgress: 'In Progress',
      todo: 'To Do',
      /* priority */
      high: 'High',
      normal: 'Normal',
      low: 'Low',
      /* schedule status */
      confirmed: 'Confirmed',
      pending: 'Pending',
      cancelled: 'Cancelled',
      approved: 'Approved',
      rejected: 'Rejected',
      /* schedule types */
      fieldwork: 'Fieldwork',
      leave: 'Leave',
      general: 'General',
      /* leave types */
      annual: 'Annual Leave',
      halfDayAM: 'Half Day (AM)',
      halfDayPM: 'Half Day (PM)',
      special: 'Special Leave',
      sick: 'Sick Leave',
      /* section headings */
      summaryReport: 'Summary Report',
      memberCards: 'Team Details',
      memberCardsTitle: 'Team Details',
      issueBoard: 'Issue Board',
      missingReport: 'Missing Reports',
      dailySummary: 'Daily Summary',
      weeklySummary: 'Weekly Summary',
      monthlySummary: 'Monthly Report',
      keyAchievements: 'Key Achievements',
      pendingIssues: 'Pending Issues',
      /* chart titles */
      memberHoursChart: 'Team Work Hours',
      categoryChart: 'Category Distribution',
      statusChart: 'Status Distribution',
      trend: 'Trend',
      categoryBreakdown: 'Category Breakdown',
      weeklyWorkload: 'Weekly Workload',
      memberContribution: 'Contribution',
      /* period status titles */
      dailyStatusTitle: 'Daily Status',
      weeklyStatusTitle: 'Weekly Status',
      monthlyStatusTitle: 'Monthly Status',
      teamMemberHours: 'Team Work Hours',
      weeklyTrendTitle: 'Weekly Work Hours Trend',
      dailyTrendTitle: 'Daily Work Hours Trend',
      /* timeline */
      dailyWorkHours: 'Daily Work Hours',
      weekSummaryTitle: 'Weekly Summary',
      weekUnit: 'Week',
      /* misc */
      dashboardTitle: 'Work Dashboard',
      workHoursBadgeText: 'Work Hours',
      workTime: 'Work Hours',
      all: 'All',
      noReports: 'No reports for this period',
      noData: 'No data',
      noPeriodData: 'No data for this period',
      noIssues: 'No issues',
      allSubmitted: 'All submitted',
      notSubmitted: 'Not submitted',
      membersSubmitted: ' submitted',
      dailyAvgPrefix: 'Daily Avg',
      teamSummaryTitle: 'Team Work Summary',
      /* weekdays */
      sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
      /* week nav labels */
      thisWeek: 'This week',
      lastWeek: 'Last week',
      weeksAgoSuffix: ' weeks ago',
      /* navigation */
      prevWeek: 'Prev',
      nextWeek: 'Next',
      prevMonth: 'Prev',
      nextMonth: 'Next',
      weekOf: 'Week',
      comparedToPrev: 'vs prev week',
      increase: 'up',
      decrease: 'down',
      noSubmitYet: 'No reports yet',
      overdue: 'Overdue',
      allDone: 'All submitted',
      /* schedule */
      calendarTitle: 'Monthly Calendar',
      scheduleList: 'Schedule List',
      scheduleGuide: 'Schedule Guide',
      guideDesc: 'Enter the following format in KakaoTalk chat to automatically register a schedule.',
      filterMember: 'Filter Member',
      allMembers: 'All Members',
      noSchedule: 'No schedule available',
      /* unit suffix */
      moreEvents: ' more',
      /* categories */
      categories: {
        sales: 'Sales', planning: 'Planning', ops: 'Operations', admin: 'Admin', meeting: 'Meeting'
      },
      /* roles */
      roles: {
        ceo: 'CEO', gm: 'GM', manager: 'Manager', director: 'Director'
      },
    }
  },

  get lang() { return this._lang; },

  /** key를 . 으로 구분해 nested 지원: i18n.t('categories.sales') */
  t(key) {
    const keys = key.split('.');
    let val = this.translations[this._lang];
    for (const k of keys) {
      if (val == null) return key;
      val = val[k];
    }
    return val != null ? String(val) : key;
  },

  setLang(lang) {
    if (lang !== 'ko' && lang !== 'en') return;
    this._lang = lang;
    localStorage.setItem('apg-lang', lang);
  }
};

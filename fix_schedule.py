with open('js/app.js','r') as f: js = f.read()

start_marker = '// common \uc77c\uc815 \uba3c\uc800, \uac1c\uc778 \uc77c\uc815 \ub098\uc911\uc5d0'
end_marker = '  return cardsHTML;'

start_idx = js.find(start_marker)
end_idx = js.find(end_marker, start_idx)

if start_idx > 0 and end_idx > 0:
    new_block = """  // \ubaa8\ub4e0 \uc77c\uc815\uc744 \ub0a0\uc9dc\uc21c \ud1b5\ud569 \uc815\ub82c (common/personal \uad6c\ubd84 \uc5c6\uc74c)
  const allItems = getAllScheduleItems();
  const grouped = {};
  allItems.forEach(item => {
    if (!grouped[item.date]) grouped[item.date] = [];
    grouped[item.date].push(item);
  });
  const sortedDates = Object.keys(grouped).sort();
  sortedDates.forEach(date => {
    grouped[date].sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
  });

  let cardsHTML = '';
  sortedDates.forEach(date => {
    const items = grouped[date];
    const dayOfWeek = new Date(date + 'T00:00:00').toLocaleDateString(i18n.lang === 'en' ? 'en-US' : 'ko-KR', { weekday: 'long' });
    const d = date.split('-');
    const dateLabel = i18n.lang === 'en'
      ? d[1] + '/' + d[2] + ' (' + dayOfWeek + ')'
      : parseInt(d[1]) + '\uc6d4 ' + parseInt(d[2]) + '\uc77c (' + dayOfWeek + ')';

    cardsHTML += '<div class="sched-card-grouped"><div class="sched-grouped-date">' + '\uD83D\uDCC5 ' + dateLabel + '</div><div class="sched-grouped-items">';

    items.forEach(item => {
      const typeColor = getTypeColor(item.type || 'general');
      const typeLabel = i18n.t(item.type) || item.type || '';
      const statusBadge = item.status ? getStatusBadge(item.status) : '';
      const memberName = item.member || (i18n.lang === 'en' ? 'All Team' : '\uc804\uc체');
      const memberColor = item.memberColor || '#6C5CE7';
      const timeStr = item.startTime ? (item.endTime ? item.startTime + '~' + item.endTime : item.startTime + '~') : '';
      const locationStr = item.location ? ' \u00B7 ' + item.location : '';
      const leaveType = item.type === 'leave' && item.leaveType ? ' (' + i18n.t(item.leaveType) + ') ' + (item.days ? item.days + '\uC77C' : '') : '';

      cardsHTML += '<div class="sched-group-item" style="border-left-color:' + typeColor + '">'
        + '<span class="sched-type-badge-sm" style="background:' + typeColor + '15;color:' + typeColor + '">' + typeLabel + '</span>'
        + '<span class="sched-member-badge" style="color:' + memberColor + '">' + memberName + '</span>'
        + ' ' + statusBadge
        + '<div class="sched-item-title">' + (item.title || '') + leaveType + '</div>'
        + (timeStr || locationStr ? '<div class="sched-item-meta">' + timeStr + locationStr + '</div>' : '')
        + '</div>';
    });

    cardsHTML += '</div></div>';
  });

  return cardsHTML;"""
    
    js = js[:start_idx] + new_block + js[end_idx + len(end_marker):]
    with open('js/app.js','w') as f: f.write(js)
    print('Updated')
else:
    print('Not found')

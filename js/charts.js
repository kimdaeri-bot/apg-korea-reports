/* charts.js — Chart.js 래퍼 */

let charts = {};

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#8888aa',
        font: { family: "'Noto Sans KR', system-ui", size: 12 },
        padding: 16,
        usePointStyle: true,
        pointStyleWidth: 8,
      }
    },
    tooltip: {
      backgroundColor: '#1a1a2e',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      titleColor: '#e8e8f0',
      bodyColor: '#8888aa',
      padding: 12,
      cornerRadius: 10,
    }
  }
};

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

/** 팀원별 수평 바 차트 */
function renderMemberHoursChart(data) {
  destroyChart('memberHours');
  const ctx = document.getElementById('memberHoursChart').getContext('2d');
  charts['memberHours'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: '업무시간',
        data: data.values,
        backgroundColor: data.colors.map(c => c + 'cc'),
        borderColor: data.colors,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: 'y',
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { display: false },
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.parsed.x}시간`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#8888aa', font: { family: "'Noto Sans KR', system-ui" } },
          border: { color: 'transparent' }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#e8e8f0', font: { family: "'Noto Sans KR', system-ui", size: 13 } },
          border: { color: 'transparent' }
        }
      }
    }
  });
}

/** 카테고리 도넛 차트 */
function renderCategoryChart(data) {
  destroyChart('category');
  const ctx = document.getElementById('categoryChart').getContext('2d');
  const COLORS = {
    '영업': '#6C5CE7',
    '기획': '#00B894',
    '운영': '#FDCB6E',
    '행정': '#74B9FF',
    '미팅': '#E17055',
  };
  charts['category'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.labels,
      datasets: [{
        data: data.values,
        backgroundColor: data.labels.map(l => (COLORS[l] || '#888') + 'cc'),
        borderColor: data.labels.map(l => COLORS[l] || '#888'),
        borderWidth: 2,
        hoverOffset: 6,
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      cutout: '68%',
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed}시간`
          }
        }
      }
    }
  });
}

/** 상태 도넛 차트 */
function renderStatusChart(data) {
  destroyChart('status');
  const ctx = document.getElementById('statusChart').getContext('2d');
  const STATUS_COLORS = {
    '완료': '#00B894',
    '진행중': '#FDCB6E',
    '예정': '#74B9FF',
  };
  charts['status'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.labels,
      datasets: [{
        data: data.values,
        backgroundColor: data.labels.map(l => (STATUS_COLORS[l] || '#888') + 'cc'),
        borderColor: data.labels.map(l => STATUS_COLORS[l] || '#888'),
        borderWidth: 2,
        hoverOffset: 6,
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      cutout: '68%',
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed}건`
          }
        }
      }
    }
  });
}

/** 주간 업무시간 추이 라인 차트 */
function renderWeeklyTrendChart(data) {
  destroyChart('weeklyTrend');
  const ctx = document.getElementById('weeklyTrendChart').getContext('2d');
  charts['weeklyTrend'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: data.datasets.map(ds => ({
        ...ds,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
        fill: false,
      }))
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          mode: 'index',
          intersect: false,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}시간`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#8888aa', font: { family: "'Noto Sans KR', system-ui" } },
          border: { color: 'transparent' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#8888aa',
            font: { family: "'Noto Sans KR', system-ui" },
            callback: v => v + 'h'
          },
          border: { color: 'transparent' }
        }
      }
    }
  });
}

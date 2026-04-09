# APG Korea 업무대시보드

APG Korea 팀원별 업무 현황을 시각화하는 정적 대시보드입니다.  
GitHub Pages로 배포 가능하며, `data/reports.json`만 업데이트하면 자동 반영됩니다.

## 구조

```
apg-korea-reports/
├── index.html          # 대시보드 메인
├── css/style.css       # 다크모드 스타일
├── js/
│   ├── app.js          # 메인 로직 (데이터 로드/렌더링)
│   └── charts.js       # Chart.js 차트 래퍼
├── data/
│   └── reports.json    # ← 이 파일만 업데이트하면 됨
└── README.md
```

## 보고 데이터 추가 방법

`data/reports.json`의 `reports` 배열에 항목 추가:

```json
{
  "date": "2026-04-10",
  "member": "윤심",
  "memberId": "8307936451",
  "items": [
    {"task": "업무 내용", "hours": 2, "category": "영업", "status": "done"}
  ],
  "issues": ["이슈가 있으면 여기"],
  "totalHours": 2
}
```

**status**: `done` (완료) | `wip` (진행중) | `todo` (예정)  
**category**: `영업` | `기획` | `운영` | `행정` | `미팅`

## 팀원 ID

| 이름   | memberId       | 역할 |
|--------|---------------|------|
| 정경준 | 7973766521    | 대표 |
| 윤심   | 8307936451    | 실장 |
| 정근아 | 8754705329    | 차장 |
| 권은미 | eunmi         | 부장 |
| 이정훈 | junghoon      | 차장 |

## GitHub Pages 배포

1. GitHub에 레포지토리 생성
2. 이 폴더 내용 push
3. Settings → Pages → Source: `main` 브랜치, `/ (root)` 선택
4. 저장 → 몇 분 후 URL 생성

> ⚠️ 로컬에서 바로 `index.html`을 열면 `fetch()` CORS 오류 발생.  
> 로컬 테스트는 `npx serve .` 또는 VS Code Live Server 사용.

## 기능

- 팀원별/주간 업무시간 바 차트
- 업무 카테고리 & 상태 분포 도넛 차트
- 최근 4주 업무시간 추이 라인 차트
- 팀원별 상세 카드 (타임라인 + 업무목록)
- 이슈 보드
- 미제출 현황 (오늘 기준)
- 기간 필터 (이번주 / 저번주 / 이번달)

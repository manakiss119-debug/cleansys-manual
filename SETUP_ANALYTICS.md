# 총량 매뉴얼 사용통계·요청사항 설정

현재 GitHub Pages 프론트 기능은 연결되어 있습니다. 실제 통계 저장과 요청사항 접수를 시작하려면 아래 1회 설정이 필요합니다.

## 1. Google 스프레드시트 생성

1. 새 Google 스프레드시트를 만듭니다.
2. 메뉴에서 `확장 프로그램 → Apps Script`를 엽니다.
3. 기존 코드를 모두 지우고 이 저장소의 `apps-script/Code.gs` 전체 내용을 붙여넣습니다.
4. Apps Script 편집기에서 `setup` 함수를 한 번 실행합니다.
   - `events` 시트와 `feedback` 시트가 자동 생성됩니다.
5. `setAdminKey` 함수를 실행하여 관리자 화면에서 사용할 비밀번호를 설정합니다.
   - 8자 이상 권장
   - 비밀번호는 GitHub 저장소에 저장되지 않습니다.

## 2. Apps Script 웹앱 배포

1. Apps Script 우측 상단 `배포 → 새 배포`를 누릅니다.
2. 유형은 `웹 앱`을 선택합니다.
3. 실행 계정: `나`
4. 액세스 권한: `모든 사용자`
5. 배포 후 생성된 `/exec` 주소를 복사합니다.

## 3. GitHub 설정 연결

저장소의 `analytics-config.json`을 아래처럼 수정합니다.

```json
{
  "endpoint": "https://script.google.com/macros/s/발급된주소/exec"
}
```

`main` 브랜치에 저장하면 GitHub Pages가 다시 배포됩니다.

## 4. 확인 방법

- 일반 매뉴얼: `https://manakiss119-debug.github.io/cleansys-manual/`
- 관리자 통계: `https://manakiss119-debug.github.io/cleansys-manual/admin.html`

관리자 화면에서 설정한 비밀번호를 입력하면 다음을 확인할 수 있습니다.

- 순 방문자 수(브라우저 기준 익명 ID)
- 방문 세션 수
- 페이지 접속 수
- 메뉴 조회 수
- 많이 본 메뉴 순위
- 분야별 조회 수
- 최근 요청사항

## 개인정보 수집 범위

현재 구현은 이름, 이메일, 전화번호, IP 주소를 직접 수집하지 않습니다. 브라우저에 생성한 익명 방문 ID, 세션 ID, 조회한 메뉴, 접속 시각과 사용자가 직접 입력한 요청 내용만 저장합니다.

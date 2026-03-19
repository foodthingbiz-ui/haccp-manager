# HACCP 거래처 관리 앱 - 프로젝트 규칙

## 절대 변경하면 안 되는 것들

### 1. Supabase 연결 (환경변수 방식)
```javascript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
```
- 절대로 URL이나 키를 코드에 직접 넣지 않는다
- 환경변수는 Vercel에 등록되어 있음
- `VITE_` 접두사 필수 (Vite 빌드 규칙)

### 2. 필수 패키지 (package.json)
```json
"dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "xlsx": "^0.18.5",
    "@supabase/supabase-js": "^2.49.1"
}
```

### 3. DB 테이블 구조

**clients 테이블:**
- id, name, contact, phone, email, address, type
- consult_type (컨설팅 종류)
- status (진행 상태)
- contract_amount (기존 호환용)
- consult_fee (컨설팅 비용)
- maintenance_fee (사후관리 비용)
- memo, registered_at, created_at, updated_at

**records 테이블:**
- id, client_id (FK → clients.id ON DELETE CASCADE)
- date, type, content
- created_at, updated_at

**haccp_records 테이블:**
- id, client_id (FK → clients.id ON DELETE CASCADE)
- category (haccp_education, hygiene_education, validity_evaluation, external_calibration, internal_calibration, water_test, self_evaluation)
- item_name (CCP명, 기기명 등)
- record_date, memo
- file_url, file_name (첨부파일)
- created_at, updated_at

**water_test_config 테이블:**
- id, client_id (FK → clients.id ON DELETE CASCADE)
- water_type (상수도 / 지하수)
- created_at

**Supabase Storage:**
- 버킷명: haccp-files (Public)
- 경로: {client_id}/{category}/{timestamp}.{ext}

### 4. 데이터 변환 규칙
- DB는 snake_case: `consult_type`, `contract_amount`, `consult_fee`, `maintenance_fee`
- 프론트는 camelCase: `consultType`, `contractAmount`, `consultFee`, `maintenanceFee`
- `dbToClient()` 함수와 `clientToDb()` 함수로 변환

### 5. RLS 정책
- clients, records 모두 RLS 활성화
- authenticated 사용자만 SELECT, INSERT, UPDATE, DELETE 가능

### 6. 배포 환경
- GitHub 저장소: haccp-manager
- 호스팅: Vercel (자동 배포)
- 프론트엔드: React + Vite
- 파일 위치: src/App.jsx (메인 코드)
- GitHub 웹 에디터로 수정 → Commit → 자동 배포

## 현재 완료된 기능
- [x] 로그인/로그아웃 (Supabase Auth)
- [x] 대시보드 (통계, 연도별 필터, 금액 분리 표시)
- [x] 거래처 CRUD (추가/수정/삭제 + DB 연동)
- [x] 상담 기록 CRUD (추가/수정 + DB 연동)
- [x] 거래처 삭제 + 확인 팝업
- [x] 계약금액 2개 분리 (컨설팅비 + 사후관리비)
- [x] 연도별 매출 필터
- [x] 검색 + 상태/종류 필터
- [x] 토스트 알림 (성공/실패)
- [x] 로딩 스피너
- [x] HACCP관리 탭 (7개 항목 + 메모 + 파일첨부)

## 아직 남은 기능
- [ ] 직원 관리 탭 (admin 전용)
- [ ] Excel 내보내기/가져오기 (DB 버전)

## 코드 수정 시 주의사항
1. Supabase 연결은 반드시 환경변수 방식 유지
2. 코드 일부만 수정할 때는 str_replace 사용 (전체 재작성 지양)
3. DB 칼럼 추가 시 dbToClient(), clientToDb() 양쪽 모두 업데이트
4. 새 테이블 추가 시 RLS 정책 필수

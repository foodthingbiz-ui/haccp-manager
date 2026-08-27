# HACCP 거래처 관리 앱 — 프로젝트 규칙

> 최종 개정: 2026-03 / v3.0.0 준비 (원료·부자재 및 성적서 관리 기능 추가)

---

## 1. 프로젝트 기본정보

- 프로젝트명: HACCP 거래처 관리 앱
- GitHub 저장소: `foodthingbiz-ui/haccp-manager`
- 프론트엔드: React + Vite
- 백엔드 / DB / Auth / Storage: Supabase (프로젝트 ID: `nxhcpacmjkhgybhpaqbm`)
- 배포: Vercel (GitHub 커밋 시 자동 배포)
- 메인 코드 파일: `src/App.jsx` (단일 파일 유지)
- 현재 운영 버전: v2.x
- 다음 목표 버전: v3.0.0
- v3 핵심 기능: 원료·부자재 및 성적서 관리

---

## 2. 가장 중요한 원칙

### 2.1 기존 기능과 데이터 보호

기존 운영 중인 기능과 데이터를 **최우선으로 보호**한다.

**기존 DB 컬럼은 별도의 마이그레이션 계획 없이 다음 작업을 하지 않는다.**
- 삭제
- 이름 변경
- 자료형 변경
- 기존 데이터 초기화

**신규 기능을 위한 다음 작업은 허용한다.**
- 신규 컬럼 추가
- 신규 테이블 추가
- FK 추가
- INDEX 추가
- UNIQUE 제약조건 추가
- 신규 Storage bucket 추가
- 신규 Edge Function 추가

단, 기존 v2 기능과 데이터의 **하위 호환성을 반드시 유지**해야 한다.

**추가 조건**
- 신규 테이블 추가 시 반드시 **RLS 활성화 + `authenticated` 정책 설정**을 함께 한다. (RLS 없는 테이블은 데이터가 노출된다.)
- 부득이하게 기존 컬럼을 변경해야 하는 경우에만: **① 데이터 백업 → ② 마이그레이션 계획 수립 → ③ 대표님 승인 → ④ 진행** 순서를 거친다. 임의 변경 금지.

### 2.2 보안 규칙

- **Supabase 연결은 반드시 환경변수 방식**으로 유지한다.
  ```javascript
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  ```
  - URL이나 키를 코드에 직접 넣지 않는다.
  - 환경변수는 Vercel에 등록되어 있다.
  - `VITE_` 접두사 필수 (Vite 빌드 규칙).
- **`service_role` 키는 프론트엔드 코드에 절대 노출 금지.** (RLS를 우회하므로 치명적이다.)
- **외부 서비스 비밀키는 프론트엔드에 절대 노출하지 않는다.** 반드시 Edge Function을 경유한다.
  - 대상: 식품안전나라 오픈 API 인증키, 네이버 클라우드 SENS(Access Key / Secret Key / Service ID) 등.
  - 예: SMS 발송은 프론트에서 직접 호출하지 않고 `send-sms` Edge Function을 통해서만 실행한다.
- Edge Function 호출 시 `apikey` 헤더 필수.

---

## 3. 필수 패키지 (package.json)

```json
"dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "xlsx": "^0.18.5",
    "@supabase/supabase-js": "^2.49.1"
}
```

---

## 4. DB 테이블 구조

### 4.1 기존 테이블 (v2 — 보호 대상)

**clients 테이블**
- id, name, contact, phone, email, address, type
- consult_type (컨설팅 종류)
- status (진행 상태 — 비용 입력 시 자동 결정)
- contract_amount (기존 호환용)
- consult_fee (컨설팅 비용)
- maintenance_fee (사후관리 비용)
- ceo_name, ceo_birth, ceo_phone (대표자 정보)
- biz_number (사업자등록번호)
- biz_types (JSON — 업종/인허가/유형 세트 배열)
- contract_date (계약일자)
- certified (boolean — 인증여부)
- certified_date (인증일자)
- memo, registered_at, created_at, updated_at
- **assigned_staff_id (UUID, FK → profiles.id ON DELETE SET NULL) — v3 신규 추가**

**records 테이블**
- id, client_id (FK → clients.id ON DELETE CASCADE)
- date, type, content
- created_at, updated_at

**haccp_records 테이블**
- id, client_id (FK → clients.id ON DELETE CASCADE)
- category (haccp_education, hygiene_education, validity_evaluation, external_calibration, internal_calibration, water_test, self_evaluation, etc_note)
- item_name (CCP명, 기기명 등)
- record_date, memo
- file_url, file_name (첨부파일 — JSON 배열)
- renewal_date, renewal_type (direct / auto), renewal_period (1m / 3m / 6m / 1y)
- alert_enabled (boolean), alert_timing (1d / 1w / 15d / 1m)
- created_at, updated_at

**water_test_config 테이블**
- id, client_id (FK → clients.id ON DELETE CASCADE)
- water_type (상수도 / 지하수)
- created_at
- 주의: 조회 시 `.maybeSingle()` 사용 (`.single()` 금지 — 406 에러)

**alert_history 테이블**
- id, haccp_record_id (FK → haccp_records.id ON DELETE CASCADE)
- client_id (FK → clients.id ON DELETE CASCADE)
- category, item_name, renewal_date, alert_timing
- completed_at (완료 시각)

**profiles 테이블**
- id (uuid), email, name, role (admin / staff)
- is_active, is_deleted
- created_at

### 4.2 v3 신규 테이블 (원료·부자재 관리) — 실제 실행 기준

> Phase A-1에서 실행한 SQL 기준. 명세서 초안보다 정규화 수준을 높였다.
> 핵심 설계: ① 제조사와 성적서를 분리하여 성적서를 **이력(여러 건)**으로 누적, ② 알림을 사건/사용자수신/SMS발송 3계층으로 분리, ③ API 원본을 확정 원료와 분리하여 검토 단계를 둠.
> 모든 테이블에 `updated_at` 자동 갱신 트리거(`haccp_set_updated_at`) 적용(조인 테이블 제외).

#### (1) 제품·인허가·원료 기본

**client_licenses (거래처 인허가번호)**
- id (BIGSERIAL), client_id (FK → clients.id CASCADE)
- license_number (필수, 공백 불가), business_type, is_active
- created_at, updated_at
- UNIQUE (client_id, license_number)
- ※ 기존 `clients.biz_types`(v2)는 그대로 유지 — 삭제·변경하지 않음

**products (제품)**
- id (BIGSERIAL), client_id (FK CASCADE), client_license_id (FK → client_licenses.id SET NULL)
- product_report_no (식품안전나라 PRDLST_REPORT_NO), product_name (필수), product_type
- source ('foodsafetykorea' 기본 / 'manual'), raw_api_data (JSONB), is_active, synced_at
- created_at, updated_at
- 부분 UNIQUE: (client_id, product_report_no) — product_report_no가 NOT NULL일 때만 (수동 제품 중복 허용)

**materials (확정 원료)**
- id (BIGSERIAL), client_id (FK CASCADE)
- material_name (필수), origin (원산지), content_ratio (함량)
- source ('manual' 기본), created_at, updated_at
- 동일성 판단 UNIQUE(expression): (client_id, lower(trim(material_name)), lower(trim(coalesce(origin,''))), trim(coalesce(content_ratio,'')))
- ※ NULL/공백 원산지·함량도 중복 방지되도록 expression index 사용

**product_raw_materials (식품안전나라 원료 원본 — C002)**
- id (BIGSERIAL), product_id (FK → products.id CASCADE)
- raw_material_name (필수), display_order
- material_id (FK → materials.id SET NULL) — 확정 원료와 연결
- review_status ('pending' 기본 / 'confirmed' / 'ignored'), raw_api_data (JSONB)
- imported_at, updated_at
- 부분 UNIQUE(expression): (product_id, coalesce(display_order,-1), lower(trim(raw_material_name)))
- ※ API가 원산지/함량을 안 주면 바로 materials로 합치지 않고 pending 상태로 검토 대기

**material_products (확정 원료 ↔ 제품 다대다)**
- material_id (FK CASCADE), product_id (FK CASCADE), created_at
- PRIMARY KEY (material_id, product_id)

#### (2) 원료 제조사·성적서

**material_manufacturers (원료 제조사)**
- id (BIGSERIAL), material_id (FK → materials.id CASCADE)
- manufacturer_name (필수), memo, created_at, updated_at
- UNIQUE(expression): (material_id, lower(trim(manufacturer_name)))
- ※ 제조사 정보만 보관. 성적서는 아래 별도 테이블

**material_certificates (원료 성적서 이력)**
- id (BIGSERIAL), material_manufacturer_id (FK CASCADE)
- cert_file_path (필수, Storage 내부 path만 — Signed URL 아님), cert_file_name (필수)
- mime_type, file_size_bytes (≥0)
- received_date, next_cert_date (다음 수령 예정일)
- alert_1month, alert_15day, alert_1day (boolean), memo
- created_at, updated_at
- ※ 한 제조사에 성적서 여러 건 누적. 새 성적서가 과거 걸 덮어쓰지 않음

#### (3) 부자재 제조사·성적서

**packagings (부자재)**
- id (BIGSERIAL), client_id (FK CASCADE)
- packaging_name (필수), packaging_type, memo, created_at, updated_at
- UNIQUE(expression): (client_id, lower(trim(packaging_name)), lower(trim(coalesce(packaging_type,''))))

**packaging_products (부자재 ↔ 제품 다대다)**
- packaging_id (FK CASCADE), product_id (FK CASCADE), created_at
- PRIMARY KEY (packaging_id, product_id)

**packaging_suppliers (부자재+제품+제조사 조합)**
- id (BIGSERIAL), packaging_id, product_id, manufacturer_name (필수), memo
- created_at, updated_at
- 복합 FK: (packaging_id, product_id) → packaging_products CASCADE
- UNIQUE(expression): (packaging_id, product_id, lower(trim(manufacturer_name)))

**packaging_certificates (부자재 성적서 이력)**
- id (BIGSERIAL), packaging_supplier_id (FK → packaging_suppliers.id CASCADE)
- cert_file_path (필수), cert_file_name (필수), mime_type, file_size_bytes (≥0)
- received_date, next_cert_date, alert_1month, alert_15day, alert_1day, memo
- created_at, updated_at
- ※ 원료와 동일하게 성적서 이력 누적 구조

#### (4) 알림·SMS

**sms_recipients (SMS 수신 번호)**
- id (BIGSERIAL), phone_number (필수), label, is_active, created_at, updated_at
- UNIQUE (phone_number)
- CHECK: phone_number ~ `^[0-9]{9,15}$` — **숫자만 저장** (예: 01012345678, 하이픈 금지)
- ※ RLS: admin(is_active_admin)만 접근

**certificate_alerts (성적서 알림 사건)**
- id (BIGSERIAL)
- material_certificate_id (FK SET? → CASCADE), packaging_certificate_id (FK CASCADE) — **둘 중 정확히 하나만** (CHECK: num_nonnulls = 1)
- alert_type ('1m' / '15d' / '1d'), scheduled_date (필수)
- status ('pending' 기본 / 'completed' / 'cancelled'), completed_at, created_at
- 부분 UNIQUE 2종: (material_certificate_id, alert_type, scheduled_date) / (packaging_certificate_id, alert_type, scheduled_date) — 중복 알림 생성 방지

**user_notifications (사용자별 앱 알림 상태)**
- id (BIGSERIAL), alert_id (FK → certificate_alerts.id CASCADE), user_id (FK → profiles.id CASCADE)
- is_read, read_at, completed_at, created_at
- UNIQUE (alert_id, user_id)
- ※ 한 알림 사건을 담당직원+관리자 등 여러 사용자에게 전달

**sms_send_history (SMS 발송 이력)**
- id (BIGSERIAL), alert_id (FK CASCADE), sms_recipient_id (FK SET NULL), phone_number (필수)
- status ('pending' 기본 / 'sent' / 'failed'), provider_message_id, error_message, sent_at, created_at
- UNIQUE (alert_id, phone_number) — **Cron 재실행 시 중복 SMS 발송 방지**
- CHECK: phone_number ~ `^[0-9]{9,15}$`
- ※ INSERT/UPDATE는 Edge Function(service_role) 전용. authenticated에는 SELECT(admin만)만 부여

---

## 5. Supabase Storage

**haccp-files (기존, Private)**
- 경로: `{client_id}/{category}/{timestamp}_{random}.{ext}`
- file_url에는 경로(path)만 저장, 표시할 때 Signed URL(1시간 만료) 생성
- `getPublicUrl` 사용 금지 → `createSignedUrl` 사용

**material-certs (v3 신규, Private, Signed URL 방식)**
- 원료 경로: `{client_id}/materials/{material_id}/{manufacturer}/{timestamp}_{random}.{ext}`
- 부자재 경로: `{client_id}/packagings/{packaging_id}/{product_id}/{manufacturer}/{timestamp}_{random}.{ext}`
- DB에는 경로만 저장: 원료는 `material_certificates.cert_file_path`, 부자재는 `packaging_certificates.cert_file_path`
- 표시할 때 `createSignedUrl`(1시간)로 변환 (`getPublicUrl` 금지)
- Storage 접근 정책: `storage.objects`에 authenticated 대상 SELECT/INSERT/UPDATE/DELETE 정책 4종 설정 완료 (`bucket_id = 'material-certs'` 조건)

---

## 6. Edge Function

- **reset-password** (기존) — 관리자의 직원 비밀번호 초기화 (Verify JWT: OFF, 호출 시 apikey 헤더 필수)
- **rapid-responder** (기존) — 직원 계정 생성
- **send-sms** (v3 신규 예정) — 원료·부자재 성적서 알림 SMS 발송
  - 입력: 수신 번호 목록, 메시지 내용 / 출력: 발송 결과
  - 네이버 SENS 시크릿 키는 이 함수 안에서만 사용 (프론트 노출 금지)

---

## 7. 데이터 변환 규칙

- DB는 snake_case: `consult_type`, `contract_amount`, `consult_fee`, `maintenance_fee` 등
- 프론트는 camelCase: `consultType`, `contractAmount`, `consultFee`, `maintenanceFee` 등
- `dbToClient()` 함수와 `clientToDb()` 함수로 변환
- **DB 칼럼 추가 시 `dbToClient()`, `clientToDb()` 양쪽 모두 업데이트**

---

## 8. RLS 정책

- 모든 테이블에 RLS 활성화. **신규 테이블 생성 시 RLS 정책 설정을 반드시 함께 한다.**
- SELECT/INSERT/UPDATE/DELETE를 분리하여 정책을 명시적으로 관리.

**관리자 판별 함수**
- `private.is_active_admin()` (SECURITY DEFINER, `private` 스키마) — role='admin' AND is_active AND NOT is_deleted 인지 검사.
- `private` 스키마는 PostgREST에 노출되지 않으므로 API로 직접 호출 불가, RLS 내부 전용.

**테이블별 접근 수준**
- **일반 업무 테이블** (client_licenses, products, materials, product_raw_materials, material_products, material_manufacturers, material_certificates, packagings, packaging_products, packaging_suppliers, packaging_certificates): authenticated 전체 CRUD.
- **sms_recipients**: admin만 CRUD.
- **certificate_alerts**: authenticated SELECT / admin만 INSERT·UPDATE·DELETE (실제 생성은 Cron·Edge Function의 service_role).
- **user_notifications**: 본인 것만 SELECT·UPDATE (admin은 전체) / admin만 INSERT·DELETE.
- **sms_send_history**: admin만 SELECT / INSERT·UPDATE는 service_role 전용 (authenticated에 미부여).

**권한(GRANT) 원칙**
- 모든 신규 테이블에서 `anon` 권한 REVOKE (비로그인 차단).
- authenticated에는 RLS로 최종 제한되는 범위 내에서 GRANT.
- `sms_send_history`는 authenticated에 sequence 권한을 주지 않음 (service_role 전용 생성).

---

## 9. 배포 환경

- GitHub 저장소: `foodthingbiz-ui/haccp-manager` (공개)
- 호스팅: Vercel (자동 배포)
- 프론트엔드: React + Vite
- 파일 위치: `src/App.jsx` (메인 코드, 단일 파일 유지)
- 작업 방식: GitHub 웹 에디터로 수정 → Commit → 자동 배포
- **커밋 후 Vercel Deployments에서 "Ready" 상태 확인이 배포의 공식 마지막 단계**
- Supabase 무료 플랜은 7일 미사용 시 자동 일시정지 → 대시보드에서 복구 (데이터는 보존됨)

---

## 10. 코드 수정 시 주의사항

1. Supabase 연결은 반드시 환경변수 방식 유지 (2.2 참조).
2. 코드 일부만 수정할 때는 부분 수정(find-and-replace) 사용, 전체 재작성 지양.
3. DB 칼럼 추가 시 `dbToClient()`, `clientToDb()` 양쪽 모두 업데이트.
4. 새 테이블 추가 시 RLS 정책 필수.
5. `water_test_config` 조회 시 `.maybeSingle()` 사용 (`.single()` 금지).
6. 한글 태그 입력 시 `onCompositionStart` / `onCompositionEnd`로 조합 중복 방지.
7. Edge Function 호출 시 `apikey` 헤더 필수.
8. 외부 서비스 비밀키는 프론트에 노출 금지, Edge Function 경유 (2.2 참조).
9. **코드 수정 시 반드시 APP_VERSION 올리기.**
   - 작은 수정 / 버그 → 패치 (예: v2.0.1)
   - 새 기능 추가 → 마이너 (예: v2.1.0)
   - 큰 구조 변경 → 메이저 (예: v3.0.0)
   - ※ 이 문서(PROJECT_RULES.md)만 수정한 경우는 App.jsx 코드 변경이 아니므로 APP_VERSION을 올리지 않는다.

---

## 11. v3 개발 진행 순서 (Phase)

- **Phase A**: 기반 준비 — DB 테이블 + RLS, Storage 버킷, PROJECT_RULES.md 업데이트 (모듈화는 단일 파일 유지 방침으로 생략)
- **Phase B**: 부자재 관리 (수동 등록/수정/삭제 + 성적서 첨부)
- **Phase C**: 원료 관리 (수동 등록 + 원료 상세 + 제조사 등록)
- **Phase D**: 식품안전나라 API 연동 (자동 조회 + 중복 병합)
- **Phase E**: 성적서 검색 탭 (상단 네비 확장 + 통합 검색)
- **Phase F**: 담당 직원 지정 (clients.assigned_staff_id 활용 UI)
- **Phase G**: 알림 시스템 (앱 팝업 + 대시보드 패널 + 브라우저 알림)
- **Phase H**: SMS 발송 (SENS 설정 + 수신번호 관리 + send-sms + 스케줄러)
- **Phase I**: 최종 정리·테스트 + APP_VERSION v3.0.0 승격

---

## 12. 완료된 기능 (v2 기준)

- [x] 로그인/로그아웃 (Supabase Auth)
- [x] 대시보드 (통계, 연도별 필터, 금액 분리 표시, 갱신 알림 패널)
- [x] 거래처 CRUD (추가/수정/삭제 + DB 연동)
- [x] 거래처 확장 입력 (대표자, 사업자등록번호, 업종/인허가/유형 세트, 인증여부)
- [x] 상담 기록 CRUD
- [x] 계약금액 2개 분리 (컨설팅비 + 사후관리비) + 컨설팅 종류별 비활성화 로직
- [x] 비용 입력 시 진행상태 자동 결정 + 계약일자 표시
- [x] 검색 + 상태/종류 필터 + 정렬 (테이블 뷰)
- [x] 토스트 알림 / 로딩 스피너
- [x] HACCP관리 탭 (8개 항목 + 메모 + 다중 파일첨부 + 갱신일자/알림)
- [x] 직원 관리 탭 (admin 전용)
- [x] 비밀번호 변경 (본인 + 관리자 초기화)
- [x] Excel 내보내기/가져오기 (전체 필드 + 에러 상세 팝업)
- [x] PWA 구성 / PC 최적화 레이아웃 / 키보드 단축키

## 13. v3 진행 상태

- [x] **Phase A: 기반 준비 완료**
  - [x] A-1: 신규 테이블 15개 + 인덱스 + RLS + 권한 + updated_at 트리거 (SQL 실행 완료)
  - [x] A-2: Storage 버킷 `material-certs`(Private) 생성 + 접근 정책 4종
  - [x] A-3: 본 문서를 실제 실행 구조로 정비
  - (모듈화는 단일 파일 유지 방침으로 생략)
- [ ] Phase B: 부자재 관리 (다음 진행 예정)
- [ ] Phase C ~ I: 대기

import { useState, useMemo, useEffect } from "react";
import * as XLSX from 'xlsx';

// ─── Supabase Config ───
const SB_URL = "https://nxhcpacmjkhgybhpaqbm.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54aGNwYWNtamtoZ3liaHBhcWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NTkzODcsImV4cCI6MjA4ODUzNTM4N30.SWmkAvlNZxtlChDrPy56s7Pu8qQvAw84NDjGClYgenY";
const SB_HEADERS = { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" };

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SB_URL}${path}`, { ...opts, headers: { ...SB_HEADERS, ...opts.headers } });
  if (!res.ok) { const t = await res.text(); throw new Error(`API ${res.status}: ${t}`); }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─── DB <-> JS Mapping ───
function dbToClient(r) {
  return { id: r.id, name: r.name, permitNumber: r.permit_number || "", businessType: r.business_type || "", category: r.category || "", ceo: r.ceo || "", ceoPhone: r.ceo_phone || "", contact: r.contact || "", phone: r.phone || "", email: r.email || "", fax: r.fax || "", address: r.address || "", consultType: r.consult_type || "신규인증", status: r.status || "상담중", consultFee: r.consult_fee || 0, maintenanceFee: r.maintenance_fee || 0, memo: r.memo || "", registeredAt: r.registered_at || "", checklist: r.checklist || null, records: [] };
}
function clientToDb(c) {
  const d = {};
  if (c.name !== undefined) d.name = c.name;
  if (c.permitNumber !== undefined) d.permit_number = c.permitNumber;
  if (c.businessType !== undefined) d.business_type = c.businessType;
  if (c.category !== undefined) d.category = c.category;
  if (c.ceo !== undefined) d.ceo = c.ceo;
  if (c.ceoPhone !== undefined) d.ceo_phone = c.ceoPhone;
  if (c.contact !== undefined) d.contact = c.contact;
  if (c.phone !== undefined) d.phone = c.phone;
  if (c.email !== undefined) d.email = c.email;
  if (c.fax !== undefined) d.fax = c.fax;
  if (c.address !== undefined) d.address = c.address;
  if (c.consultType !== undefined) d.consult_type = c.consultType;
  if (c.status !== undefined) d.status = c.status;
  if (c.consultFee !== undefined) d.consult_fee = c.consultFee;
  if (c.maintenanceFee !== undefined) d.maintenance_fee = c.maintenanceFee;
  if (c.memo !== undefined) d.memo = c.memo;
  if (c.registeredAt !== undefined) d.registered_at = c.registeredAt;
  if (c.checklist !== undefined) d.checklist = c.checklist;
  return d;
}
function dbToRecord(r) { return { id: r.id, clientId: r.client_id, date: r.date, type: r.type, content: r.content || "", attachments: [] }; }

// ─── API Functions ───
async function fetchAllData() {
  const [dbClients, dbRecords, dbAttachments] = await Promise.all([
    sbFetch("/rest/v1/clients?order=created_at.desc"),
    sbFetch("/rest/v1/records?order=date.desc"),
    sbFetch("/rest/v1/attachments?order=created_at.asc"),
  ]);
  const clients = dbClients.map(dbToClient);
  const records = dbRecords.map(dbToRecord);
  dbAttachments.forEach(a => {
    const rec = records.find(r => r.id === a.record_id);
    if (rec) rec.attachments.push({ id: a.id, fileName: a.file_name, filePath: a.file_path, fileSize: a.file_size, fileType: a.file_type });
  });
  clients.forEach(c => { c.records = records.filter(r => r.clientId === c.id); });
  return clients;
}
async function apiCreateClient(data) {
  const res = await sbFetch("/rest/v1/clients", { method: "POST", body: JSON.stringify(clientToDb(data)) });
  return res[0];
}
async function apiUpdateClient(id, data) {
  await sbFetch(`/rest/v1/clients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(clientToDb(data)) });
}
async function apiDeleteClient(id) {
  await sbFetch(`/rest/v1/clients?id=eq.${id}`, { method: "DELETE" });
}
async function apiCreateRecord(clientId, data) {
  const body = { client_id: clientId, date: data.date, type: data.type, content: data.content };
  const res = await sbFetch("/rest/v1/records", { method: "POST", body: JSON.stringify(body) });
  return res[0];
}
async function apiUpdateRecord(id, data) {
  const body = {};
  if (data.date) body.date = data.date;
  if (data.type) body.type = data.type;
  if (data.content !== undefined) body.content = data.content;
  await sbFetch(`/rest/v1/records?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(body) });
}
async function apiUploadFile(recordId, file) {
  const ext = file.name.split(".").pop();
  const path = `${recordId}/${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`;
  await fetch(`${SB_URL}/storage/v1/object/record-files/${path}`, {
    method: "POST", headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": file.type }, body: file,
  });
  await sbFetch("/rest/v1/attachments", { method: "POST", body: JSON.stringify({ record_id: recordId, file_name: file.name, file_path: path, file_size: file.size, file_type: file.type }) });
}
async function apiDeleteAttachment(id, filePath) {
  await fetch(`${SB_URL}/storage/v1/object/record-files/${filePath}`, { method: "DELETE", headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` } });
  await sbFetch(`/rest/v1/attachments?id=eq.${id}`, { method: "DELETE" });
}
function getFileUrl(path) { return `${SB_URL}/storage/v1/object/public/record-files/${path}`; }

// ─── Constants ───
const STATUS_CONFIG = { "상담중": { color: "#f59e0b", bg: "#fef3c7", icon: "💬" }, "계약완료": { color: "#3b82f6", bg: "#dbeafe", icon: "📝" }, "컨설팅 진행중": { color: "#8b5cf6", bg: "#ede9fe", icon: "🔧" }, "완료": { color: "#10b981", bg: "#d1fae5", icon: "✅" } };
const CONSULT_TYPES = { "신규인증": { color: "#e11d48", bg: "#ffe4e6", icon: "🆕" }, "정기 사후관리": { color: "#0284c7", bg: "#e0f2fe", icon: "🔄" }, "단기 사후관리": { color: "#d97706", bg: "#fef9c3", icon: "⚡" }, "연장심사": { color: "#7c3aed", bg: "#f3e8ff", icon: "📋" } };
const RECORD_TYPES = { "방문": "🏢", "상담": "💬", "전화": "📞" };
const formatMoney = (n) => n ? n.toLocaleString("ko-KR") + "원" : "0원";
const formatDate = (d) => { const dt = new Date(d); return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,"0")}.${String(dt.getDate()).padStart(2,"0")}`; };
const getYear = (d) => new Date(d).getFullYear();
const formatFileSize = (b) => b < 1024 ? b + "B" : b < 1048576 ? (b/1024).toFixed(1) + "KB" : (b/1048576).toFixed(1) + "MB";

const HACCP_CHECKLIST_TEMPLATE = [
  { group: "사전 준비", items: [{ id: "p1", label: "HACCP 팀 구성", done: false, memo: "" }, { id: "p2", label: "제품 설명서 작성", done: false, memo: "" }, { id: "p3", label: "용도 확인 및 유통방법 기술", done: false, memo: "" }, { id: "p4", label: "공정흐름도 작성", done: false, memo: "" }, { id: "p5", label: "공정흐름도 현장 확인", done: false, memo: "" }] },
  { group: "선행요건 프로그램", items: [{ id: "s1", label: "영업장 관리", done: false, memo: "" }, { id: "s2", label: "위생 관리", done: false, memo: "" }, { id: "s3", label: "제조·가공 시설설비 관리", done: false, memo: "" }, { id: "s4", label: "냉장·냉동 시설설비 관리", done: false, memo: "" }, { id: "s5", label: "용수 관리", done: false, memo: "" }, { id: "s6", label: "보관·운송 관리", done: false, memo: "" }, { id: "s7", label: "검사 관리", done: false, memo: "" }, { id: "s8", label: "회수 프로그램 관리", done: false, memo: "" }] },
  { group: "HACCP 관리", items: [{ id: "h1", label: "위해요소 분석", done: false, memo: "" }, { id: "h2", label: "중요관리점(CCP) 결정", done: false, memo: "" }, { id: "h3", label: "한계기준 설정", done: false, memo: "" }, { id: "h4", label: "모니터링 체계 확립", done: false, memo: "" }, { id: "h5", label: "개선조치 방법 수립", done: false, memo: "" }, { id: "h6", label: "검증절차 및 방법 설정", done: false, memo: "" }, { id: "h7", label: "문서화 및 기록유지 방법 설정", done: false, memo: "" }] },
  { group: "심사 준비", items: [{ id: "a1", label: "HACCP 관련 서류 정리", done: false, memo: "" }, { id: "a2", label: "모의 심사 실시", done: false, memo: "" }, { id: "a3", label: "보완사항 개선 완료", done: false, memo: "" }, { id: "a4", label: "인증 심사 신청", done: false, memo: "" }, { id: "a5", label: "본 심사 완료", done: false, memo: "" }] },
];
function getDefaultChecklist() { return HACCP_CHECKLIST_TEMPLATE.map(g => ({ group: g.group, items: g.items.map(i => ({ ...i })) })); }

// ─── Excel Helpers ───
const EXCEL_COLUMNS = [
  { header: "업체명", key: "name" }, { header: "허가번호", key: "permitNumber" }, { header: "업종", key: "businessType" }, { header: "유형", key: "category" }, { header: "대표자", key: "ceo" }, { header: "대표자 연락처", key: "ceoPhone" }, { header: "담당자", key: "contact" }, { header: "담당자 연락처", key: "phone" }, { header: "이메일", key: "email" }, { header: "팩스번호", key: "fax" }, { header: "주소", key: "address" }, { header: "컨설팅 종류", key: "consultType" }, { header: "진행상태", key: "status" }, { header: "일반 컨설팅 비용", key: "consultFee" }, { header: "정기 사후관리 비용", key: "maintenanceFee" }, { header: "메모", key: "memo" }, { header: "등록일", key: "registeredAt" },
];
function exportToExcel(clients) {
  const rows = clients.map(c => { const row = {}; EXCEL_COLUMNS.forEach(col => { row[col.header] = (col.key === "consultFee" || col.key === "maintenanceFee") ? (c[col.key] || 0) : col.key === "registeredAt" ? formatDate(c[col.key]) : (c[col.key] || ""); }); return row; });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = EXCEL_COLUMNS.map(col => ({ wch: col.key === "address" || col.key === "memo" ? 30 : col.key === "email" ? 22 : 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "거래처 목록");
  const recRows = []; clients.forEach(c => { c.records.forEach(r => { recRows.push({ "업체명": c.name, "날짜": formatDate(r.date), "유형": r.type, "내용": r.content }); }); });
  if (recRows.length > 0) { const ws2 = XLSX.utils.json_to_sheet(recRows); ws2["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 50 }]; XLSX.utils.book_append_sheet(wb, ws2, "상담 기록"); }
  XLSX.writeFile(wb, `거래처관리_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ─── UI Components ───
function StatusBadge({ status, size = "md" }) { const cfg = STATUS_CONFIG[status] || { color: "#6b7280", bg: "#f3f4f6", icon: "?" }; const pad = size === "sm" ? "2px 8px" : "4px 14px"; const fs = size === "sm" ? "12px" : "13px"; return <span style={{ background: cfg.bg, color: cfg.color, padding: pad, borderRadius: "20px", fontSize: fs, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px", border: `1px solid ${cfg.color}22` }}><span>{cfg.icon}</span> {status}</span>; }
function ConsultBadge({ consultType, size = "md" }) { const cfg = CONSULT_TYPES[consultType] || { color: "#6b7280", bg: "#f3f4f6", icon: "?" }; const pad = size === "sm" ? "2px 8px" : "4px 14px"; const fs = size === "sm" ? "12px" : "13px"; return <span style={{ background: cfg.bg, color: cfg.color, padding: pad, borderRadius: "20px", fontSize: fs, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px", border: `1px solid ${cfg.color}22` }}><span>{cfg.icon}</span> {consultType}</span>; }

function Dashboard({ clients, onNavigate }) {
  const allYears = useMemo(() => { const yrs = new Set(); clients.forEach(c => yrs.add(getYear(c.registeredAt))); return [...yrs].sort((a, b) => b - a); }, [clients]);
  const [selectedYear, setSelectedYear] = useState("전체");
  const stats = useMemo(() => {
    const total = clients.length;
    const byStatus = {}; Object.keys(STATUS_CONFIG).forEach(s => byStatus[s] = clients.filter(c => c.status === s).length);
    const byConsultType = {}; Object.keys(CONSULT_TYPES).forEach(ct => byConsultType[ct] = clients.filter(c => c.consultType === ct).length);
    const filtered = selectedYear === "전체" ? clients : clients.filter(c => getYear(c.registeredAt) === Number(selectedYear));
    const totalConsultFee = filtered.reduce((s, c) => s + (c.consultFee || 0), 0);
    const totalMaintenanceFee = filtered.reduce((s, c) => s + (c.maintenanceFee || 0), 0);
    const recentRecords = clients.flatMap(c => c.records.map(r => ({ ...r, clientName: c.name, clientId: c.id }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    return { total, byStatus, byConsultType, totalConsultFee, totalMaintenanceFee, totalRevenue: totalConsultFee + totalMaintenanceFee, recentRecords };
  }, [clients, selectedYear]);

  return (
    <div>
      <div style={{ marginBottom: "28px" }}><h2 style={{ fontSize: "22px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>대시보드</h2><p style={{ color: "#64748b", fontSize: "14px", marginTop: "4px" }}>전체 거래처 현황을 한눈에 확인하세요</p></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        <div style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", borderRadius: "16px", padding: "22px", color: "white" }}><div style={{ fontSize: "13px", opacity: 0.7, marginBottom: "8px" }}>전체 거래처</div><div style={{ fontSize: "32px", fontWeight: 800 }}>{stats.total}</div></div>
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (<div key={status} style={{ background: "white", borderRadius: "16px", padding: "22px", border: "1px solid #e8ecf2", position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", top: "-10px", right: "-10px", fontSize: "50px", opacity: 0.08 }}>{cfg.icon}</div><div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>{status}</div><div style={{ fontSize: "32px", fontWeight: 800, color: cfg.color }}>{stats.byStatus[status]}</div></div>))}
      </div>
      <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e8ecf2", padding: "22px", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 16px 0" }}>컨설팅 종류별 현황</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
          {Object.entries(CONSULT_TYPES).map(([ct, cfg]) => (<div key={ct} style={{ background: cfg.bg, borderRadius: "12px", padding: "16px", border: `1px solid ${cfg.color}15`, position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", top: "-6px", right: "-6px", fontSize: "36px", opacity: 0.12 }}>{cfg.icon}</div><div style={{ fontSize: "12px", color: cfg.color, fontWeight: 600, marginBottom: "6px" }}>{ct}</div><div style={{ fontSize: "26px", fontWeight: 800, color: cfg.color }}>{stats.byConsultType[ct]}</div></div>))}
        </div>
      </div>
      <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e8ecf2", padding: "24px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>매출 현황</h3>
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={{ padding: "7px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "white", color: "#0f766e", fontSize: "13px", fontWeight: 600, cursor: "pointer", outline: "none", appearance: "auto", minWidth: "100px" }}>
            {["전체", ...allYears.map(String)].map(yr => (<option key={yr} value={yr}>{yr === "전체" ? "전체" : yr + "년"}</option>))}
          </select>
        </div>
        <div style={{ display: "grid", gap: "12px", marginBottom: "16px" }}>
          <div style={{ background: "#f0fdf4", borderRadius: "14px", padding: "18px", border: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: "12px", color: "#15803d", fontWeight: 600, marginBottom: "4px" }}>🔧 일반 컨설팅 비용</div><div style={{ fontSize: "13px", color: "#64748b" }}>신규인증 · 연장심사 · 단기 사후관리</div></div><div style={{ fontSize: "22px", fontWeight: 800, color: "#15803d" }}>{formatMoney(stats.totalConsultFee)}</div></div>
          <div style={{ background: "#eff6ff", borderRadius: "14px", padding: "18px", border: "1px solid #bfdbfe", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: "12px", color: "#1d4ed8", fontWeight: 600, marginBottom: "4px" }}>🔄 정기 사후관리 비용</div><div style={{ fontSize: "13px", color: "#64748b" }}>정기 사후관리 계약</div></div><div style={{ fontSize: "22px", fontWeight: 800, color: "#1d4ed8" }}>{formatMoney(stats.totalMaintenanceFee)}</div></div>
        </div>
        <div style={{ background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)", borderRadius: "14px", padding: "20px", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontSize: "13px", opacity: 0.8 }}>총 매출액 {selectedYear !== "전체" ? `(${selectedYear}년)` : "(전체)"}</div><div style={{ fontSize: "26px", fontWeight: 800 }}>{formatMoney(stats.totalRevenue)}</div></div>
      </div>
      <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e8ecf2", padding: "24px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 18px 0" }}>최근 활동</h3>
        {stats.recentRecords.length === 0 && <p style={{ color: "#94a3b8", fontSize: "14px" }}>아직 기록이 없습니다.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {stats.recentRecords.map((r, i) => (<div key={i} onClick={() => onNavigate("detail", r.clientId)} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px", borderRadius: "12px", background: "#f8fafc", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"} onMouseLeave={e => e.currentTarget.style.background = "#f8fafc"}><span style={{ fontSize: "20px", flexShrink: 0, marginTop: "2px" }}>{RECORD_TYPES[r.type] || "?"}</span><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a2e" }}>{r.clientName}</div><div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.content.split("\n")[0]}</div></div><span style={{ fontSize: "12px", color: "#94a3b8", flexShrink: 0, marginTop: "2px" }}>{formatDate(r.date)}</span></div>))}
        </div>
      </div>
    </div>
  );
}

function ClientList({ clients, onNavigate, onAdd, onExport }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [filterConsultType, setFilterConsultType] = useState("전체");
  const [filterYear, setFilterYear] = useState("전체");
  const allYears = useMemo(() => { const yrs = new Set(); clients.forEach(c => yrs.add(getYear(c.registeredAt))); return [...yrs].sort((a, b) => b - a); }, [clients]);
  const filtered = useMemo(() => clients.filter(c => {
    const ms = !search || c.name.includes(search) || c.contact.includes(search) || c.phone.includes(search) || c.businessType.includes(search) || c.ceo.includes(search);
    const mst = filterStatus === "전체" || c.status === filterStatus;
    const mct = filterConsultType === "전체" || c.consultType === filterConsultType;
    const my = filterYear === "전체" || getYear(c.registeredAt) === Number(filterYear);
    return ms && mst && mct && my;
  }), [clients, search, filterStatus, filterConsultType, filterYear]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "12px" }}>
        <div><h2 style={{ fontSize: "22px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>거래처 목록</h2><p style={{ color: "#64748b", fontSize: "14px", marginTop: "4px" }}>총 {filtered.length}곳</p></div>
        <button onClick={onAdd} style={{ background: "#1a1a2e", color: "white", border: "none", borderRadius: "12px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><span style={{ fontSize: "18px" }}>+</span> 거래처 추가</button>
      </div>
      <div style={{ marginBottom: "14px" }}>
        <button onClick={() => onExport(filtered)} style={{ width: "100%", padding: "9px 14px", borderRadius: "10px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>📥 엑셀 내보내기</button>
      </div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
        <div style={{ position: "relative", flex: 1 }}><span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", color: "#94a3b8" }}>🔍</span><input type="text" placeholder="거래처명, 대표자, 담당자, 업종 검색..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "12px 12px 12px 40px", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "14px", outline: "none", background: "white", boxSizing: "border-box" }} onFocus={e => e.target.style.borderColor = "#1a1a2e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} /></div>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ padding: "10px 14px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "white", color: filterYear === "전체" ? "#64748b" : "#1a1a2e", fontSize: "14px", fontWeight: 600, cursor: "pointer", outline: "none", appearance: "auto", minWidth: "100px", flexShrink: 0 }}><option value="전체">전체 연도</option>{allYears.map(yr => <option key={yr} value={String(yr)}>{yr}년</option>)}</select>
      </div>
      <div style={{ marginBottom: "10px" }}><div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, marginBottom: "6px" }}>진행 상태</div><div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{["전체", ...Object.keys(STATUS_CONFIG)].map(s => (<button key={s} onClick={() => setFilterStatus(s)} style={{ padding: "6px 14px", borderRadius: "10px", border: filterStatus === s ? "2px solid #1a1a2e" : "1px solid #e2e8f0", background: filterStatus === s ? "#1a1a2e" : "white", color: filterStatus === s ? "white" : "#64748b", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>{s}</button>))}</div></div>
      <div style={{ marginBottom: "18px" }}><div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, marginBottom: "6px" }}>컨설팅 종류</div><div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{["전체", ...Object.keys(CONSULT_TYPES)].map(ct => { const cfg = CONSULT_TYPES[ct]; const a = filterConsultType === ct; return (<button key={ct} onClick={() => setFilterConsultType(ct)} style={{ padding: "6px 14px", borderRadius: "10px", border: a ? `2px solid ${cfg ? cfg.color : "#1a1a2e"}` : "1px solid #e2e8f0", background: a ? (cfg ? cfg.bg : "#1a1a2e") : "white", color: a ? (cfg ? cfg.color : "white") : "#64748b", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>{cfg ? cfg.icon + " " : ""}{ct}</button>); })}</div></div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filtered.map(c => { const total = (c.consultFee||0)+(c.maintenanceFee||0); const cl = c.checklist||getDefaultChecklist(); const clAll = cl.flatMap(g=>g.items); const clPct = clAll.length > 0 ? Math.round(clAll.filter(i=>i.done).length/clAll.length*100) : 0; return (
          <div key={c.id} onClick={() => onNavigate("detail", c.id)} style={{ background: "white", borderRadius: "14px", border: "1px solid #e8ecf2", padding: "18px 20px", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "translateY(-1px)"; }} onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg, #1a1a2e, #16213e)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "16px", flexShrink: 0 }}>{c.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}><span style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e" }}>{c.name}</span><StatusBadge status={c.status} size="sm" /></div><div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}><ConsultBadge consultType={c.consultType} size="sm" /><span style={{ fontSize: "12px", color: "#94a3b8" }}>{c.contact} · {c.phone}</span></div></div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>{total > 0 && <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f766e" }}>{formatMoney(total)}</div>}<div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>{c.businessType}</div></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}><span style={{ fontSize: "11px", color: "#94a3b8", flexShrink: 0 }}>진행률</span><div style={{ flex: 1, background: "#f1f5f9", borderRadius: "6px", height: "8px", overflow: "hidden" }}><div style={{ width: `${clPct}%`, height: "100%", borderRadius: "6px", background: clPct === 100 ? "#10b981" : "#3b82f6", transition: "width 0.3s" }} /></div><span style={{ fontSize: "11px", fontWeight: 700, color: clPct === 100 ? "#10b981" : "#3b82f6", minWidth: "32px", textAlign: "right" }}>{clPct}%</span></div>
          </div>); })}
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: "48px 20px", color: "#94a3b8" }}><div style={{ fontSize: "40px", marginBottom: "12px" }}>🔍</div><div style={{ fontSize: "15px" }}>검색 결과가 없습니다</div></div>}
      </div>
    </div>
  );
}

function ClientDetail({ client, onBack, onUpdate, onAddRecord, onUpdateRecord, onDelete, onUploadFile, onDeleteAttachment, reload }) {
  const [activeTab, setActiveTab] = useState("info");
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [newRecord, setNewRecord] = useState({ date: new Date().toISOString().split("T")[0], type: "상담", content: "" });
  const [newFiles, setNewFiles] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editRecordData, setEditRecordData] = useState({ date: "", type: "", content: "" });
  const [memoTarget, setMemoTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!client) return null;
  const totalFee = (client.consultFee||0)+(client.maintenanceFee||0);
  const inputStyle = { width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: "10px", fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  const handleSaveRecord = async () => {
    if (!newRecord.content.trim()) return;
    setSaving(true);
    try {
      const created = await onAddRecord(client.id, newRecord);
      if (created && newFiles.length > 0) {
        for (const f of newFiles) { await onUploadFile(created.id, f); }
      }
      setNewRecord({ date: new Date().toISOString().split("T")[0], type: "상담", content: "" });
      setNewFiles([]);
      setShowRecordForm(false);
      await reload();
    } catch (e) { alert("저장 실패: " + e.message); }
    setSaving(false);
  };
  const handleSaveEdit = async () => { setSaving(true); try { await onUpdate(client.id, editData); setIsEditing(false); await reload(); } catch(e) { alert("수정 실패: "+e.message); } setSaving(false); };
  const saveEditRecord = async () => { if (!editRecordData.content.trim()) return; setSaving(true); try { await onUpdateRecord(editingRecordId, editRecordData); setEditingRecordId(null); await reload(); } catch(e) { alert("수정 실패: "+e.message); } setSaving(false); };

  const tabs = [{ key: "info", label: "기본 정보", icon: "📋" }, { key: "records", label: "상담 기록", icon: "📝" }, { key: "contract", label: "계약/매출", icon: "💰" }, { key: "checklist", label: "진행률", icon: "✅" }];
  const infoPairs = [
    [{ label: "업체명", value: client.name }, { label: "허가번호", value: client.permitNumber }],
    [{ label: "업종", value: client.businessType }, { label: "유형", value: client.category }],
    [{ label: "대표자", value: client.ceo }, { label: "대표자 연락처", value: client.ceoPhone }],
    [{ label: "담당자", value: client.contact }, { label: "담당자 연락처", value: client.phone }],
    [{ label: "이메일", value: client.email }, { label: "팩스번호", value: client.fax }],
    [{ label: "주소", value: client.address, full: true }],
    [{ label: "컨설팅 종류", value: "__consultType__" }, { label: "진행상태", value: "__status__" }],
    [{ label: "메모", value: client.memo, full: true }],
  ];
  const editPairs = [[["name","업체명"],["permitNumber","허가번호"]],[["businessType","업종"],["category","유형"]],[["ceo","대표자"],["ceoPhone","대표자 연락처"]],[["contact","담당자"],["phone","담당자 연락처"]],[["email","이메일"],["fax","팩스번호"]],[["address","주소"]]];

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748b", fontSize: "14px", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}>← 목록으로</button>
          <button onClick={() => { if (confirm(`"${client.name}" 거래처를 삭제하시겠습니까?\n모든 상담 기록과 첨부파일도 함께 삭제됩니다.`)) onDelete(client.id); }} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "5px 12px", fontSize: "12px", color: "#dc2626", cursor: "pointer", fontWeight: 600 }}>🗑 삭제</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "linear-gradient(135deg, #1a1a2e, #16213e)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "20px", flexShrink: 0 }}>{client.name[0]}</div>
          <div style={{ flex: 1 }}><h2 style={{ fontSize: "22px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>{client.name}</h2><div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}><StatusBadge status={client.status} /><ConsultBadge consultType={client.consultType} /></div></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", background: "#f1f5f9", borderRadius: "14px", padding: "4px" }}>
        {tabs.map(t => (<button key={t.key} onClick={() => setActiveTab(t.key)} style={{ flex: 1, padding: "10px 8px", borderRadius: "10px", border: "none", background: activeTab === t.key ? "white" : "transparent", color: activeTab === t.key ? "#1a1a2e" : "#64748b", fontSize: "13px", fontWeight: 600, cursor: "pointer", boxShadow: activeTab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>{t.icon} {t.label}</button>))}
      </div>

      {/* ── Info Tab ── */}
      {activeTab === "info" && (
        <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e8ecf2", padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>기본 정보</h3>
            {!isEditing ? <button onClick={() => { setIsEditing(true); setEditData({ ...client }); }} style={{ background: "#f1f5f9", border: "none", borderRadius: "8px", padding: "6px 14px", fontSize: "13px", color: "#64748b", cursor: "pointer", fontWeight: 600 }}>수정</button> : <div style={{ display: "flex", gap: "6px" }}><button onClick={() => setIsEditing(false)} style={{ background: "#f1f5f9", border: "none", borderRadius: "8px", padding: "6px 14px", fontSize: "13px", color: "#64748b", cursor: "pointer" }}>취소</button><button onClick={handleSaveEdit} disabled={saving} style={{ background: "#1a1a2e", border: "none", borderRadius: "8px", padding: "6px 14px", fontSize: "13px", color: "white", cursor: "pointer", fontWeight: 600, opacity: saving ? 0.6 : 1 }}>{saving ? "저장중..." : "저장"}</button></div>}
          </div>
          {!isEditing ? (
            <div style={{ display: "grid", gap: "0" }}>
              {infoPairs.map((pair, pi) => { const isFull = pair.length === 1 && pair[0].full; const renderCell = (item) => (<div key={item.label} style={{ padding: "10px 0", display: "flex", flexDirection: "column", gap: "3px" }}><span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, letterSpacing: "0.3px" }}>{item.label}</span>{item.value === "__consultType__" ? <ConsultBadge consultType={client.consultType} size="sm" /> : item.value === "__status__" ? <StatusBadge status={client.status} size="sm" /> : item.label === "메모" ? <span style={{ fontSize: "14px", color: "#1a1a2e", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.6", maxHeight: "67.2px", overflowY: "auto", paddingRight: "4px" }}>{item.value || "-"}</span> : <span style={{ fontSize: "14px", color: "#1a1a2e", wordBreak: "break-word" }}>{item.value || "-"}</span>}</div>); return (<div key={pi} style={{ display: "grid", gridTemplateColumns: isFull ? "1fr" : "1fr 1fr", gap: "12px", padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>{pair.map(item => renderCell(item))}</div>); })}
            </div>
          ) : (
            <div style={{ display: "grid", gap: "14px" }}>
              {editPairs.map((pair, pi) => (<div key={pi} style={{ display: "grid", gridTemplateColumns: pair.length === 1 ? "1fr" : "1fr 1fr", gap: "12px" }}>{pair.map(([key, label]) => (<div key={key}><label style={{ fontSize: "13px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>{label}</label><input value={editData[key] || ""} onChange={e => setEditData({ ...editData, [key]: e.target.value })} style={inputStyle} /></div>))}</div>))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div><label style={{ fontSize: "13px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "6px" }}>컨설팅 종류</label><div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{Object.entries(CONSULT_TYPES).map(([ct, cfg]) => (<button key={ct} type="button" onClick={() => setEditData({ ...editData, consultType: ct })} style={{ padding: "6px 10px", borderRadius: "10px", border: editData.consultType === ct ? `2px solid ${cfg.color}` : "1px solid #e2e8f0", background: editData.consultType === ct ? cfg.bg : "white", color: editData.consultType === ct ? cfg.color : "#64748b", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "3px" }}>{cfg.icon} {ct}</button>))}</div></div>
                <div><label style={{ fontSize: "13px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "6px" }}>진행상태</label><select value={editData.status||""} onChange={e => setEditData({ ...editData, status: e.target.value })} style={{ ...inputStyle, appearance: "auto" }}>{Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              </div>
              <div><label style={{ fontSize: "13px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>메모</label><textarea value={editData.memo || ""} onChange={e => setEditData({ ...editData, memo: e.target.value })} rows={5} style={{ ...inputStyle, resize: "vertical" }} /></div>
            </div>
          )}
        </div>
      )}

      {/* ── Records Tab ── */}
      {activeTab === "records" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>상담 기록</h3>
            <button onClick={() => setShowRecordForm(!showRecordForm)} style={{ background: "#1a1a2e", color: "white", border: "none", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>{showRecordForm ? "취소" : "+ 기록 추가"}</button>
          </div>
          {showRecordForm && (
            <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "20px", marginBottom: "16px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div><label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>날짜</label><input type="date" value={newRecord.date} onChange={e => setNewRecord({ ...newRecord, date: e.target.value })} style={inputStyle} /></div>
                <div><label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>유형</label><select value={newRecord.type} onChange={e => setNewRecord({ ...newRecord, type: e.target.value })} style={{ ...inputStyle, appearance: "auto" }}>{Object.keys(RECORD_TYPES).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              <div style={{ marginBottom: "12px" }}><label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>내용</label><textarea value={newRecord.content} onChange={e => setNewRecord({ ...newRecord, content: e.target.value })} placeholder={"상담 내용을 입력하세요...\n엔터를 눌러 줄을 바꿀 수 있습니다"} rows={5} style={{ ...inputStyle, resize: "vertical" }} /></div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>📎 파일 첨부</label>
                <input type="file" multiple onChange={e => setNewFiles([...e.target.files])} style={{ fontSize: "13px" }} />
                {newFiles.length > 0 && <div style={{ marginTop: "6px", fontSize: "12px", color: "#64748b" }}>{newFiles.length}개 파일 선택됨</div>}
              </div>
              <button onClick={handleSaveRecord} disabled={saving} style={{ background: "#0f766e", color: "white", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer", width: "100%", opacity: saving ? 0.6 : 1 }}>{saving ? "저장중..." : "저장"}</button>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "500px", overflowY: "auto", paddingRight: "4px" }}>
            {client.records.length === 0 && <p style={{ color: "#94a3b8", fontSize: "14px", textAlign: "center", padding: "32px 0" }}>아직 기록이 없습니다.</p>}
            {client.records.map((r) => (
              <div key={r.id} style={{ background: "white", borderRadius: "14px", border: editingRecordId === r.id ? "2px solid #1a1a2e" : "1px solid #e8ecf2", padding: "16px 20px" }}>
                {editingRecordId === r.id ? (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                      <div><label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>날짜</label><input type="date" value={editRecordData.date} onChange={e => setEditRecordData({ ...editRecordData, date: e.target.value })} style={inputStyle} /></div>
                      <div><label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>유형</label><select value={editRecordData.type} onChange={e => setEditRecordData({ ...editRecordData, type: e.target.value })} style={{ ...inputStyle, appearance: "auto" }}>{Object.keys(RECORD_TYPES).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    </div>
                    <div style={{ marginBottom: "12px" }}><label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>내용</label><textarea value={editRecordData.content} onChange={e => setEditRecordData({ ...editRecordData, content: e.target.value })} rows={5} style={{ ...inputStyle, resize: "vertical" }} /></div>
                    <div style={{ display: "flex", gap: "8px" }}><button onClick={() => setEditingRecordId(null)} style={{ flex: 1, padding: "9px", border: "1px solid #e2e8f0", borderRadius: "10px", background: "white", fontSize: "13px", cursor: "pointer", color: "#64748b", fontWeight: 600 }}>취소</button><button onClick={saveEditRecord} disabled={saving} style={{ flex: 1, padding: "9px", border: "none", borderRadius: "10px", background: "#0f766e", color: "white", fontSize: "13px", cursor: "pointer", fontWeight: 600, opacity: saving?0.6:1 }}>{saving?"저장중...":"수정 완료"}</button></div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                      <span style={{ fontSize: "18px" }}>{RECORD_TYPES[r.type] || "?"}</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a2e" }}>{r.type}</span>
                      <span style={{ fontSize: "12px", color: "#94a3b8", marginLeft: "auto" }}>{formatDate(r.date)}</span>
                      <button onClick={() => { setEditingRecordId(r.id); setEditRecordData({ date: r.date, type: r.type, content: r.content }); }} style={{ background: "#f1f5f9", border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", color: "#64748b", cursor: "pointer", fontWeight: 600, marginLeft: "4px" }}>수정</button>
                    </div>
                    <p style={{ fontSize: "14px", color: "#475569", margin: 0, lineHeight: "1.7", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "71.4px", overflowY: "auto", paddingRight: "4px" }}>{r.content}</p>
                    {/* Attachments */}
                    {r.attachments && r.attachments.length > 0 && (
                      <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                        <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, marginBottom: "6px" }}>📎 첨부파일 ({r.attachments.length})</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {r.attachments.map(att => (
                            <div key={att.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", background: "#f8fafc", borderRadius: "8px", fontSize: "13px" }}>
                              <span style={{ fontSize: "14px" }}>{att.fileType?.startsWith("image/") ? "🖼️" : "📄"}</span>
                              <a href={getFileUrl(att.filePath)} target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6", textDecoration: "none", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.fileName}</a>
                              <span style={{ fontSize: "11px", color: "#94a3b8", flexShrink: 0 }}>{formatFileSize(att.fileSize)}</span>
                              <button onClick={async () => { if (confirm(`"${att.fileName}" 파일을 삭제하시겠습니까?`)) { await onDeleteAttachment(att.id, att.filePath); await reload(); }}} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#dc2626", padding: "2px" }}>✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Contract Tab ── */}
      {activeTab === "contract" && (
        <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e8ecf2", padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>계약 / 매출 정보</h3>
            {!isEditing && <button onClick={() => { setIsEditing(true); setEditData({ ...client }); }} style={{ background: "#f1f5f9", border: "none", borderRadius: "8px", padding: "6px 14px", fontSize: "13px", color: "#64748b", cursor: "pointer", fontWeight: 600 }}>수정</button>}
          </div>
          {!isEditing ? (
            <div style={{ display: "grid", gap: "14px" }}>
              <div style={{ background: "#f0fdf4", borderRadius: "14px", padding: "20px", border: "1px solid #bbf7d0" }}><div style={{ fontSize: "12px", color: "#15803d", fontWeight: 600, marginBottom: "8px" }}>🔧 일반 컨설팅 비용</div><div style={{ fontSize: "26px", fontWeight: 800, color: "#15803d" }}>{formatMoney(client.consultFee)}</div></div>
              <div style={{ background: "#eff6ff", borderRadius: "14px", padding: "20px", border: "1px solid #bfdbfe" }}><div style={{ fontSize: "12px", color: "#1d4ed8", fontWeight: 600, marginBottom: "8px" }}>🔄 정기 사후관리 비용</div><div style={{ fontSize: "26px", fontWeight: 800, color: "#1d4ed8" }}>{formatMoney(client.maintenanceFee)}</div></div>
              <div style={{ background: "linear-gradient(135deg, #0f766e, #14b8a6)", borderRadius: "14px", padding: "20px", color: "white" }}><div style={{ fontSize: "13px", opacity: 0.8, marginBottom: "6px" }}>총 계약 금액</div><div style={{ fontSize: "28px", fontWeight: 800 }}>{formatMoney(totalFee)}</div></div>
              <div style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9", display: "flex", gap: "12px", alignItems: "center" }}><span style={{ fontSize: "13px", color: "#94a3b8", width: "85px", flexShrink: 0, fontWeight: 600 }}>진행 상태</span><StatusBadge status={client.status} /></div>
              <div style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9", display: "flex", gap: "12px", alignItems: "center" }}><span style={{ fontSize: "13px", color: "#94a3b8", width: "85px", flexShrink: 0, fontWeight: 600 }}>컨설팅 종류</span><ConsultBadge consultType={client.consultType} /></div>
              <div style={{ padding: "12px 0", display: "flex", gap: "12px" }}><span style={{ fontSize: "13px", color: "#94a3b8", width: "85px", flexShrink: 0, fontWeight: 600 }}>등록일</span><span style={{ fontSize: "14px", color: "#1a1a2e" }}>{formatDate(client.registeredAt)}</span></div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div><label style={{ fontSize: "13px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>🔧 일반 컨설팅 비용 (원)</label><input type="number" value={editData.consultFee||0} onChange={e => setEditData({ ...editData, consultFee: Number(e.target.value)||0 })} style={inputStyle} /></div>
                <div><label style={{ fontSize: "13px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>🔄 정기 사후관리 비용 (원)</label><input type="number" value={editData.maintenanceFee||0} onChange={e => setEditData({ ...editData, maintenanceFee: Number(e.target.value)||0 })} style={inputStyle} /></div>
              </div>
              <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px", border: "1px solid #e2e8f0" }}><div style={{ fontSize: "13px", color: "#64748b", marginBottom: "4px" }}>합계 (자동 계산)</div><div style={{ fontSize: "22px", fontWeight: 800, color: "#0f766e" }}>{formatMoney((editData.consultFee||0)+(editData.maintenanceFee||0))}</div></div>
              <div style={{ display: "flex", gap: "8px" }}><button onClick={() => setIsEditing(false)} style={{ flex: 1, padding: "10px", border: "1px solid #e2e8f0", borderRadius: "10px", background: "white", fontSize: "13px", cursor: "pointer", color: "#64748b", fontWeight: 600 }}>취소</button><button onClick={handleSaveEdit} disabled={saving} style={{ flex: 1, padding: "10px", border: "none", borderRadius: "10px", background: "#1a1a2e", color: "white", fontSize: "13px", cursor: "pointer", fontWeight: 600, opacity: saving?0.6:1 }}>{saving?"저장중...":"저장"}</button></div>
            </div>
          )}
        </div>
      )}

      {/* ── Checklist Tab ── */}
      {activeTab === "checklist" && (() => {
        const checklist = client.checklist || getDefaultChecklist();
        const allItems = checklist.flatMap(g => g.items);
        const doneCount = allItems.filter(i => i.done).length;
        const totalCount = allItems.length;
        const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
        const toggleItem = async (gi, ii) => { const updated = checklist.map((g, gx) => gx !== gi ? g : { ...g, items: g.items.map((item, ix) => ix !== ii ? item : { ...item, done: !item.done }) }); await onUpdate(client.id, { checklist: updated }); await reload(); };
        const saveMemo = async (gi, ii, memoText) => { const updated = checklist.map((g, gx) => gx !== gi ? g : { ...g, items: g.items.map((item, ix) => ix !== ii ? item : { ...item, memo: memoText }) }); await onUpdate(client.id, { checklist: updated }); await reload(); };
        const resetChecklist = async () => { if (confirm("체크리스트를 초기화하시겠습니까?")) { await onUpdate(client.id, { checklist: getDefaultChecklist() }); await reload(); } };
        return (
          <div>
            <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e8ecf2", padding: "22px", marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}><h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>HACCP 컨설팅 진행률</h3><button onClick={resetChecklist} style={{ background: "#f1f5f9", border: "none", borderRadius: "8px", padding: "5px 12px", fontSize: "12px", color: "#64748b", cursor: "pointer", fontWeight: 600 }}>초기화</button></div>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}><div style={{ flex: 1, background: "#f1f5f9", borderRadius: "10px", height: "18px", overflow: "hidden" }}><div style={{ width: `${percent}%`, height: "100%", borderRadius: "10px", background: percent === 100 ? "linear-gradient(135deg, #10b981, #34d399)" : "linear-gradient(135deg, #3b82f6, #60a5fa)", transition: "width 0.4s ease" }} /></div><span style={{ fontSize: "20px", fontWeight: 800, color: percent === 100 ? "#10b981" : "#3b82f6", minWidth: "52px", textAlign: "right" }}>{percent}%</span></div>
              <div style={{ fontSize: "13px", color: "#64748b", marginTop: "8px" }}>{doneCount} / {totalCount} 항목 완료</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {checklist.map((group, gi) => { const gd = group.items.filter(i => i.done).length; const gt = group.items.length; const gc = gd === gt; return (
                <div key={gi} style={{ background: "white", borderRadius: "16px", border: gc ? "1px solid #bbf7d0" : "1px solid #e8ecf2", padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "16px" }}>{gc ? "✅" : "📋"}</span><span style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e" }}>{group.group}</span></div><span style={{ fontSize: "12px", fontWeight: 600, color: gc ? "#10b981" : "#64748b", background: gc ? "#d1fae5" : "#f1f5f9", padding: "3px 10px", borderRadius: "8px" }}>{gd}/{gt}</span></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {group.items.map((item, ii) => (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", background: item.done ? "#f0fdf4" : "#fafafa", border: item.done ? "1px solid #bbf7d022" : "1px solid transparent" }}>
                        <div onClick={() => toggleItem(gi, ii)} style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, cursor: "pointer" }}>
                          <div style={{ width: "22px", height: "22px", borderRadius: "6px", border: item.done ? "2px solid #10b981" : "2px solid #d1d5db", background: item.done ? "#10b981" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.done && <span style={{ color: "white", fontSize: "13px", fontWeight: 700 }}>✓</span>}</div>
                          <span style={{ fontSize: "14px", color: item.done ? "#15803d" : "#374151", textDecoration: item.done ? "line-through" : "none", fontWeight: item.done ? 500 : 400 }}>{item.label}</span>
                        </div>
                        <button onClick={e => { e.stopPropagation(); setMemoTarget({ gi, ii, label: item.label, memo: item.memo || "" }); }} style={{ background: "none", border: "none", padding: "4px 6px", cursor: "pointer", fontSize: "16px", flexShrink: 0, opacity: item.memo?.trim() ? 1 : 0.4, position: "relative" }}>📝{item.memo?.trim() && <span style={{ position: "absolute", top: "2px", right: "2px", width: "7px", height: "7px", borderRadius: "50%", background: "#3b82f6" }} />}</button>
                      </div>
                    ))}
                  </div>
                </div>); })}
            </div>
            {memoTarget && (() => { const handleSaveMemo = () => { saveMemo(memoTarget.gi, memoTarget.ii, memoTarget.memo); setMemoTarget(null); }; return (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px", backdropFilter: "blur(4px)" }} onClick={handleSaveMemo}>
                <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "440px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}><h4 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>📝 메모</h4><button onClick={handleSaveMemo} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#94a3b8", padding: "0 4px" }}>✕</button></div>
                  <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px" }}><span style={{ fontSize: "13px", color: "#64748b" }}>{memoTarget.label}</span></div>
                  <textarea value={memoTarget.memo} onChange={e => setMemoTarget({ ...memoTarget, memo: e.target.value })} placeholder={"메모를 입력하세요...\n엔터를 눌러 줄을 바꿀 수 있습니다"} rows={5} style={{ width: "100%", padding: "12px 14px", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "none", lineHeight: "1.6", overflowY: "auto" }} autoFocus />
                  <button onClick={handleSaveMemo} style={{ marginTop: "14px", width: "100%", padding: "11px", border: "none", borderRadius: "12px", background: "#1a1a2e", color: "white", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>저장</button>
                </div>
              </div>); })()}
          </div>); })()}
    </div>
  );
}

function AddClientModal({ onClose, onSave, saving }) {
  const [form, setForm] = useState({ name: "", permitNumber: "", businessType: "", category: "", ceo: "", ceoPhone: "", contact: "", phone: "", email: "", fax: "", address: "", consultType: "신규인증", status: "상담중", consultFee: 0, maintenanceFee: 0, memo: "" });
  const inputStyle = { width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: "10px", fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const handleSave = () => { if (!form.name.trim()) return alert("업체명을 입력해주세요."); onSave({ ...form, consultFee: Number(form.consultFee)||0, maintenanceFee: Number(form.maintenanceFee)||0, registeredAt: new Date().toISOString().split("T")[0] }); };
  const formPairs = [[["name","업체명 *"],["permitNumber","허가번호"]],[["businessType","업종"],["category","유형"]],[["ceo","대표자"],["ceoPhone","대표자 연락처"]],[["contact","담당자"],["phone","담당자 연락처"]],[["email","이메일"],["fax","팩스번호"]],[["address","주소"]]];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "540px", maxHeight: "85vh", overflow: "auto" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 20px 0" }}>새 거래처 추가</h3>
        <div style={{ display: "grid", gap: "14px" }}>
          {formPairs.map((pair, pi) => (<div key={pi} style={{ display: "grid", gridTemplateColumns: pair.length === 1 ? "1fr" : "1fr 1fr", gap: "12px" }}>{pair.map(([key, label]) => (<div key={key}><label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>{label}</label><input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle} placeholder={label.replace(" *","")} /></div>))}</div>))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div><label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "6px" }}>컨설팅 종류</label><div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{Object.entries(CONSULT_TYPES).map(([ct, cfg]) => (<button key={ct} type="button" onClick={() => setForm({ ...form, consultType: ct })} style={{ padding: "6px 10px", borderRadius: "10px", border: form.consultType === ct ? `2px solid ${cfg.color}` : "1px solid #e2e8f0", background: form.consultType === ct ? cfg.bg : "white", color: form.consultType === ct ? cfg.color : "#64748b", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "3px" }}>{cfg.icon} {ct}</button>))}</div></div>
            <div><label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "6px" }}>진행상태</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ ...inputStyle, appearance: "auto" }}>{Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div><label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>🔧 일반 컨설팅 비용 (원)</label><input type="number" value={form.consultFee} onChange={e => setForm({ ...form, consultFee: e.target.value })} style={inputStyle} placeholder="0" /></div>
            <div><label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>🔄 정기 사후관리 비용 (원)</label><input type="number" value={form.maintenanceFee} onChange={e => setForm({ ...form, maintenanceFee: e.target.value })} style={inputStyle} placeholder="0" /></div>
          </div>
          <div><label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>메모</label><textarea value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder={"추가 정보...\n엔터를 눌러 줄을 바꿀 수 있습니다"} /></div>
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: "12px", background: "white", fontSize: "14px", cursor: "pointer", color: "#64748b" }}>취소</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "12px", border: "none", borderRadius: "12px", background: "#1a1a2e", color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer", opacity: saving?0.6:1 }}>{saving ? "저장중..." : "추가"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ───
export default function App() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try { const data = await fetchAllData(); setClients(data); setError(null); }
    catch (e) { setError("데이터 로드 실패: " + e.message); }
    setLoading(false);
  };
  useEffect(() => { loadData(); }, []);

  const navigate = (v, id) => { setView(v); if (id) setSelectedId(id); };
  const selectedClient = clients.find(c => c.id === selectedId);

  const handleAddClient = async (data) => { setSaving(true); try { await apiCreateClient(data); await loadData(); setShowAddModal(false); } catch(e) { alert("추가 실패: "+e.message); } setSaving(false); };
  const handleUpdateClient = async (id, data) => { await apiUpdateClient(id, data); };
  const handleDeleteClient = async (id) => { setSaving(true); try { await apiDeleteClient(id); await loadData(); navigate("list"); } catch(e) { alert("삭제 실패: "+e.message); } setSaving(false); };
  const handleAddRecord = async (clientId, data) => { const res = await apiCreateRecord(clientId, data); return res; };
  const handleUpdateRecord = async (id, data) => { await apiUpdateRecord(id, data); };
  const handleExport = (list) => { if (list.length === 0) return alert("내보낼 거래처가 없습니다."); exportToExcel(list); };

  const navItems = [{ key: "dashboard", label: "대시보드", icon: "📊" }, { key: "list", label: "거래처", icon: "🏢" }];

  if (loading) return (<div style={{ minHeight: "100vh", background: "#f4f6fa", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR', sans-serif" }}><div style={{ textAlign: "center" }}><div style={{ fontSize: "40px", marginBottom: "16px" }}>🏢</div><div style={{ fontSize: "16px", color: "#64748b", fontWeight: 600 }}>데이터 불러오는 중...</div></div></div>);
  if (error) return (<div style={{ minHeight: "100vh", background: "#f4f6fa", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR', sans-serif" }}><div style={{ textAlign: "center", maxWidth: "400px", padding: "20px" }}><div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div><div style={{ fontSize: "16px", color: "#dc2626", fontWeight: 600, marginBottom: "12px" }}>{error}</div><button onClick={() => { setLoading(true); loadData(); }} style={{ padding: "10px 24px", borderRadius: "10px", border: "none", background: "#1a1a2e", color: "white", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>다시 시도</button></div></div>);

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6fa", fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", padding: "16px 24px", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ fontSize: "22px" }}>🏢</span><span style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "-0.3px" }}>거래처 관리</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
          <span style={{ fontSize: "11px", opacity: 0.7 }}>서버 연결됨</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "4px", padding: "12px 16px", background: "white", borderBottom: "1px solid #e8ecf2" }}>
        {navItems.map(item => (<button key={item.key} onClick={() => navigate(item.key)} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: view === item.key || (view === "detail" && item.key === "list") ? "#1a1a2e" : "transparent", color: view === item.key || (view === "detail" && item.key === "list") ? "white" : "#64748b", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>{item.icon} {item.label}</button>))}
      </div>
      <div style={{ padding: "20px 16px", maxWidth: "680px", margin: "0 auto" }}>
        {view === "dashboard" && <Dashboard clients={clients} onNavigate={navigate} />}
        {view === "list" && <ClientList clients={clients} onNavigate={navigate} onAdd={() => setShowAddModal(true)} onExport={handleExport} />}
        {view === "detail" && <ClientDetail client={selectedClient} onBack={() => navigate("list")} onUpdate={handleUpdateClient} onAddRecord={handleAddRecord} onUpdateRecord={handleUpdateRecord} onDelete={handleDeleteClient} onUploadFile={apiUploadFile} onDeleteAttachment={apiDeleteAttachment} reload={loadData} />}
      </div>
      {showAddModal && <AddClientModal onClose={() => setShowAddModal(false)} onSave={handleAddClient} saving={saving} />}
    </div>
  );
}

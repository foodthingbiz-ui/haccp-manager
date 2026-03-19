import { useState, useMemo, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase 설정 ───
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── 상수 설정 ───
const STATUS_CONFIG = {
  "상담중": { color: "#f59e0b", bg: "#fef3c7", icon: "💬" },
  "계약완료": { color: "#3b82f6", bg: "#dbeafe", icon: "📝" },
  "컨설팅 진행중": { color: "#8b5cf6", bg: "#ede9fe", icon: "🔧" },
  "완료": { color: "#10b981", bg: "#d1fae5", icon: "✅" },
};

const CONSULT_TYPES = {
  "신규인증": { color: "#e11d48", bg: "#ffe4e6", icon: "🆕" },
  "정기 사후관리": { color: "#0284c7", bg: "#e0f2fe", icon: "🔄" },
  "단기 사후관리": { color: "#d97706", bg: "#fef9c3", icon: "⚡" },
  "연장심사": { color: "#7c3aed", bg: "#f3e8ff", icon: "📋" },
};

const RECORD_TYPES = { "방문": "🏢", "상담": "💬", "전화": "📞" };

const formatMoney = (n) => n ? n.toLocaleString("ko-KR") + "원" : "-";
const formatDate = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
};

// ─── DB → 프론트 데이터 변환 (snake_case → camelCase) ───
function dbToClient(row, records = []) {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact || "",
    phone: row.phone || "",
    email: row.email || "",
    address: row.address || "",
    type: row.type || "",
    consultType: row.consult_type || "신규인증",
    status: row.status || "상담중",
    contractAmount: row.contract_amount || 0,
    consultFee: row.consult_fee || 0,
    maintenanceFee: row.maintenance_fee || 0,
    memo: row.memo || "",
    registeredAt: row.registered_at || "",
    records: records.map(r => ({
      id: r.id,
      date: r.date,
      type: r.type,
      content: r.content || "",
    })),
  };
}

// ─── 프론트 → DB 데이터 변환 (camelCase → snake_case) ───
function clientToDb(data) {
  const result = {};
  if (data.name !== undefined) result.name = data.name;
  if (data.contact !== undefined) result.contact = data.contact;
  if (data.phone !== undefined) result.phone = data.phone;
  if (data.email !== undefined) result.email = data.email;
  if (data.address !== undefined) result.address = data.address;
  if (data.type !== undefined) result.type = data.type;
  if (data.consultType !== undefined) result.consult_type = data.consultType;
  if (data.status !== undefined) result.status = data.status;
  if (data.contractAmount !== undefined) result.contract_amount = data.contractAmount;
  if (data.consultFee !== undefined) result.consult_fee = data.consultFee;
  if (data.maintenanceFee !== undefined) result.maintenance_fee = data.maintenanceFee;
  if (data.memo !== undefined) result.memo = data.memo;
  if (data.registeredAt !== undefined) result.registered_at = data.registeredAt;
  return result;
}

// ─── 로딩 스피너 ───
function LoadingSpinner({ message = "로딩 중..." }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", color: "#64748b" }}>
      <div style={{ width: "36px", height: "36px", border: "3px solid #e2e8f0", borderTopColor: "#1a1a2e", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: "16px" }} />
      <div style={{ fontSize: "14px" }}>{message}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── 토스트 알림 ───
function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: { bg: "#d1fae5", color: "#065f46", icon: "✅" },
    error: { bg: "#fee2e2", color: "#991b1b", icon: "❌" },
    info: { bg: "#dbeafe", color: "#1e40af", icon: "ℹ️" },
  };
  const c = colors[type] || colors.info;

  return (
    <div style={{ position: "fixed", top: "80px", left: "50%", transform: "translateX(-50%)", background: c.bg, color: c.color, padding: "12px 24px", borderRadius: "12px", fontSize: "14px", fontWeight: 600, zIndex: 2000, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", gap: "8px", animation: "slideDown 0.3s ease" }}>
      <span>{c.icon}</span> {message}
      <style>{`@keyframes slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
    </div>
  );
}

// ─── 배지 컴포넌트 ───
function StatusBadge({ status, size = "md" }) {
  const cfg = STATUS_CONFIG[status] || { color: "#6b7280", bg: "#f3f4f6", icon: "?" };
  const pad = size === "sm" ? "2px 8px" : "4px 14px";
  const fs = size === "sm" ? "12px" : "13px";
  return <span style={{ background: cfg.bg, color: cfg.color, padding: pad, borderRadius: "20px", fontSize: fs, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px", border: `1px solid ${cfg.color}22` }}><span>{cfg.icon}</span> {status}</span>;
}

function ConsultBadge({ consultType, size = "md" }) {
  const cfg = CONSULT_TYPES[consultType] || { color: "#6b7280", bg: "#f3f4f6", icon: "?" };
  const pad = size === "sm" ? "2px 8px" : "4px 14px";
  const fs = size === "sm" ? "12px" : "13px";
  return <span style={{ background: cfg.bg, color: cfg.color, padding: pad, borderRadius: "20px", fontSize: fs, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px", border: `1px solid ${cfg.color}22` }}><span>{cfg.icon}</span> {consultType}</span>;
}

// ─── 대시보드 ───
function Dashboard({ clients, onNavigate }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState("전체");

  // 거래처 등록일에서 연도 목록 추출
  const years = useMemo(() => {
    const yearSet = new Set();
    clients.forEach(c => {
      if (c.registeredAt) yearSet.add(new Date(c.registeredAt).getFullYear());
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [clients]);

  // 선택된 연도로 필터링
  const filteredClients = useMemo(() => {
    if (selectedYear === "전체") return clients;
    return clients.filter(c => c.registeredAt && new Date(c.registeredAt).getFullYear() === selectedYear);
  }, [clients, selectedYear]);

  const stats = useMemo(() => {
    const total = filteredClients.length;
    const byStatus = {};
    Object.keys(STATUS_CONFIG).forEach(s => byStatus[s] = filteredClients.filter(c => c.status === s).length);
    const byConsultType = {};
    Object.keys(CONSULT_TYPES).forEach(ct => byConsultType[ct] = filteredClients.filter(c => c.consultType === ct).length);
    const totalConsultFee = filteredClients.reduce((sum, c) => sum + (c.consultFee || 0), 0);
    const totalMaintenanceFee = filteredClients.reduce((sum, c) => sum + (c.maintenanceFee || 0), 0);
    const totalRevenue = totalConsultFee + totalMaintenanceFee;
    const recentRecords = filteredClients.flatMap(c => c.records.map(r => ({ ...r, clientName: c.name, clientId: c.id }))).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5);
    return { total, byStatus, byConsultType, totalConsultFee, totalMaintenanceFee, totalRevenue, recentRecords };
  }, [filteredClients]);

  return (
    <div>
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>대시보드</h2>
        <p style={{ color: "#64748b", fontSize: "14px", marginTop: "4px" }}>전체 거래처 현황을 한눈에 확인하세요</p>
      </div>
      {/* 연도 필터 */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, marginBottom: "6px" }}>연도별 보기</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {["전체", ...years].map(y => (
            <button key={y} onClick={() => setSelectedYear(y)} style={{ padding: "6px 14px", borderRadius: "10px", border: selectedYear === y ? "2px solid #1a1a2e" : "1px solid #e2e8f0", background: selectedYear === y ? "#1a1a2e" : "white", color: selectedYear === y ? "white" : "#64748b", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>{y === "전체" ? "전체" : `${y}년`}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        <div style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", borderRadius: "16px", padding: "22px", color: "white" }}>
          <div style={{ fontSize: "13px", opacity: 0.7, marginBottom: "8px" }}>전체 거래처</div>
          <div style={{ fontSize: "32px", fontWeight: 800 }}>{stats.total}</div>
        </div>
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
          <div key={status} style={{ background: "white", borderRadius: "16px", padding: "22px", border: "1px solid #e8ecf2", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: "-10px", right: "-10px", fontSize: "50px", opacity: 0.08 }}>{cfg.icon}</div>
            <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>{status}</div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: cfg.color }}>{stats.byStatus[status]}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e8ecf2", padding: "22px", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 16px 0" }}>컨설팅 종류별 현황</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
          {Object.entries(CONSULT_TYPES).map(([ct, cfg]) => (
            <div key={ct} style={{ background: cfg.bg, borderRadius: "12px", padding: "16px", border: `1px solid ${cfg.color}15`, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: "-6px", right: "-6px", fontSize: "36px", opacity: 0.12 }}>{cfg.icon}</div>
              <div style={{ fontSize: "12px", color: cfg.color, fontWeight: 600, marginBottom: "6px" }}>{ct}</div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: cfg.color }}>{stats.byConsultType[ct]}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)", borderRadius: "16px", padding: "24px", color: "white", marginBottom: "16px" }}>
        <div style={{ fontSize: "13px", opacity: 0.8, marginBottom: "6px" }}>총 계약 금액{selectedYear !== "전체" ? ` (${selectedYear}년)` : ""}</div>
        <div style={{ fontSize: "28px", fontWeight: 800 }}>{formatMoney(stats.totalRevenue)}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "28px" }}>
        <div style={{ background: "#ede9fe", borderRadius: "14px", padding: "18px" }}>
          <div style={{ fontSize: "12px", color: "#7c3aed", fontWeight: 600, marginBottom: "6px" }}>컨설팅 비용 합계</div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#7c3aed" }}>{formatMoney(stats.totalConsultFee)}</div>
        </div>
        <div style={{ background: "#e0f2fe", borderRadius: "14px", padding: "18px" }}>
          <div style={{ fontSize: "12px", color: "#0284c7", fontWeight: 600, marginBottom: "6px" }}>사후관리 비용 합계</div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#0284c7" }}>{formatMoney(stats.totalMaintenanceFee)}</div>
        </div>
      </div>
      <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e8ecf2", padding: "24px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 18px 0" }}>최근 활동</h3>
        {stats.recentRecords.length === 0 && <p style={{ color: "#94a3b8", fontSize: "14px" }}>아직 기록이 없습니다.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {stats.recentRecords.map((r, i) => (
            <div key={i} onClick={() => onNavigate("detail", r.clientId)} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px", borderRadius: "12px", background: "#f8fafc", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"} onMouseLeave={e => e.currentTarget.style.background = "#f8fafc"}>
              <span style={{ fontSize: "20px", flexShrink: 0, marginTop: "2px" }}>{RECORD_TYPES[r.type] || "?"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a2e" }}>{r.clientName}</div>
                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(r.content || "").split("\n")[0]}</div>
              </div>
              <span style={{ fontSize: "12px", color: "#94a3b8", flexShrink: 0, marginTop: "2px" }}>{formatDate(r.date)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 거래처 목록 ───
function ClientList({ clients, onNavigate, onAdd }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [filterConsultType, setFilterConsultType] = useState("전체");

  const filtered = useMemo(() => {
    return clients.filter(c => {
      const matchSearch = !search || c.name.includes(search) || c.contact.includes(search) || c.phone.includes(search) || c.type.includes(search);
      const matchStatus = filterStatus === "전체" || c.status === filterStatus;
      const matchConsultType = filterConsultType === "전체" || c.consultType === filterConsultType;
      return matchSearch && matchStatus && matchConsultType;
    });
  }, [clients, search, filterStatus, filterConsultType]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>거래처 목록</h2>
          <p style={{ color: "#64748b", fontSize: "14px", marginTop: "4px" }}>총 {filtered.length}곳</p>
        </div>
        <button onClick={onAdd} style={{ background: "#1a1a2e", color: "white", border: "none", borderRadius: "12px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "18px" }}>+</span> 거래처 추가
        </button>
      </div>
      <div style={{ position: "relative", marginBottom: "14px" }}>
        <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", color: "#94a3b8" }}>🔍</span>
        <input type="text" placeholder="거래처명, 담당자, 연락처 검색..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "12px 12px 12px 40px", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "14px", outline: "none", background: "white", boxSizing: "border-box" }} onFocus={e => e.target.style.borderColor = "#1a1a2e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
      </div>
      <div style={{ marginBottom: "10px" }}>
        <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, marginBottom: "6px" }}>진행 상태</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {["전체", ...Object.keys(STATUS_CONFIG)].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: "6px 14px", borderRadius: "10px", border: filterStatus === s ? "2px solid #1a1a2e" : "1px solid #e2e8f0", background: filterStatus === s ? "#1a1a2e" : "white", color: filterStatus === s ? "white" : "#64748b", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>{s}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: "18px" }}>
        <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, marginBottom: "6px" }}>컨설팅 종류</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {["전체", ...Object.keys(CONSULT_TYPES)].map(ct => {
            const cfg = CONSULT_TYPES[ct];
            const isActive = filterConsultType === ct;
            return (
              <button key={ct} onClick={() => setFilterConsultType(ct)} style={{ padding: "6px 14px", borderRadius: "10px", border: isActive ? `2px solid ${cfg ? cfg.color : "#1a1a2e"}` : "1px solid #e2e8f0", background: isActive ? (cfg ? cfg.bg : "#1a1a2e") : "white", color: isActive ? (cfg ? cfg.color : "white") : "#64748b", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                {cfg ? cfg.icon + " " : ""}{ct}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filtered.map(c => (
          <div key={c.id} onClick={() => onNavigate("detail", c.id)} style={{ background: "white", borderRadius: "14px", border: "1px solid #e8ecf2", padding: "18px 20px", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "translateY(-1px)"; }} onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg, #1a1a2e, #16213e)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "16px", flexShrink: 0 }}>{c.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e" }}>{c.name}</span>
                  <StatusBadge status={c.status} size="sm" />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                  <ConsultBadge consultType={c.consultType} size="sm" />
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>{c.contact} · {c.phone}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {(c.consultFee + c.maintenanceFee) > 0 && <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f766e" }}>{formatMoney(c.consultFee + c.maintenanceFee)}</div>}
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>{c.type}</div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "#94a3b8" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔍</div>
            <div style={{ fontSize: "15px" }}>검색 결과가 없습니다</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 거래처 상세 ───
function ClientDetail({ client, onBack, onUpdate, onAddRecord, onUpdateRecord, onDelete }) {
  const [activeTab, setActiveTab] = useState("info");
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [newRecord, setNewRecord] = useState({ date: new Date().toISOString().split("T")[0], type: "상담", content: "" });
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ ...client });
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editRecordData, setEditRecordData] = useState({ date: "", type: "", content: "" });
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!client) return null;

  const handleSaveRecord = async () => {
    if (!newRecord.content.trim()) return;
    setSaving(true);
    await onAddRecord(client.id, newRecord);
    setNewRecord({ date: new Date().toISOString().split("T")[0], type: "상담", content: "" });
    setShowRecordForm(false);
    setSaving(false);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    await onUpdate(client.id, editData);
    setIsEditing(false);
    setSaving(false);
  };

  const startEditRecord = (record) => {
    setEditingRecordId(record.id);
    setEditRecordData({ date: record.date, type: record.type, content: record.content });
  };

  const cancelEditRecord = () => {
    setEditingRecordId(null);
    setEditRecordData({ date: "", type: "", content: "" });
  };

  const saveEditRecord = async () => {
    if (!editRecordData.content.trim()) return;
    setSaving(true);
    await onUpdateRecord(client.id, editingRecordId, editRecordData);
    setEditingRecordId(null);
    setEditRecordData({ date: "", type: "", content: "" });
    setSaving(false);
  };

  const tabs = [
    { key: "info", label: "기본 정보", icon: "📋" },
    { key: "records", label: "상담 기록", icon: "📝" },
    { key: "haccp", label: "HACCP관리", icon: "🔬" },
    { key: "contract", label: "계약/매출", icon: "💰" },
  ];

  const inputStyle = { width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: "10px", fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748b", fontSize: "14px", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}>← 목록으로</button>
          <button onClick={() => setShowDeleteConfirm(true)} style={{ background: "#fee2e2", border: "none", borderRadius: "8px", padding: "6px 14px", fontSize: "13px", color: "#991b1b", cursor: "pointer", fontWeight: 600 }}>삭제</button>
        </div>

        {/* 삭제 확인 팝업 */}
        {showDeleteConfirm && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#991b1b", marginBottom: "8px" }}>정말 삭제하시겠습니까?</div>
            <div style={{ fontSize: "13px", color: "#b91c1c", marginBottom: "16px" }}>"{client.name}" 거래처와 관련된 모든 상담 기록이 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: "10px", border: "1px solid #e2e8f0", borderRadius: "10px", background: "white", fontSize: "13px", cursor: "pointer", color: "#64748b", fontWeight: 600 }}>취소</button>
              <button onClick={() => onDelete(client.id)} style={{ flex: 1, padding: "10px", border: "none", borderRadius: "10px", background: "#dc2626", color: "white", fontSize: "13px", cursor: "pointer", fontWeight: 600 }}>삭제하기</button>
            </div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "linear-gradient(135deg, #1a1a2e, #16213e)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "20px", flexShrink: 0 }}>{client.name[0]}</div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>{client.name}</h2>
            <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <StatusBadge status={client.status} />
              <ConsultBadge consultType={client.consultType} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", background: "#f1f5f9", borderRadius: "14px", padding: "4px" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ flex: 1, padding: "10px 8px", borderRadius: "10px", border: "none", background: activeTab === t.key ? "white" : "transparent", color: activeTab === t.key ? "#1a1a2e" : "#64748b", fontSize: "13px", fontWeight: 600, cursor: "pointer", boxShadow: activeTab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Info Tab ── */}
      {activeTab === "info" && (
        <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e8ecf2", padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>기본 정보</h3>
            {!isEditing ? (
              <button onClick={() => { setIsEditing(true); setEditData({ ...client }); }} style={{ background: "#f1f5f9", border: "none", borderRadius: "8px", padding: "6px 14px", fontSize: "13px", color: "#64748b", cursor: "pointer", fontWeight: 600 }}>수정</button>
            ) : (
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => setIsEditing(false)} style={{ background: "#f1f5f9", border: "none", borderRadius: "8px", padding: "6px 14px", fontSize: "13px", color: "#64748b", cursor: "pointer" }}>취소</button>
                <button onClick={handleSaveEdit} disabled={saving} style={{ background: "#1a1a2e", border: "none", borderRadius: "8px", padding: "6px 14px", fontSize: "13px", color: "white", cursor: "pointer", fontWeight: 600, opacity: saving ? 0.6 : 1 }}>{saving ? "저장 중..." : "저장"}</button>
              </div>
            )}
          </div>
          {!isEditing ? (
            <div style={{ display: "grid", gap: "16px" }}>
              {[["업체명", client.name], ["업종", client.type], ["컨설팅 종류", null], ["담당자", client.contact], ["연락처", client.phone], ["이메일", client.email], ["주소", client.address], ["메모", client.memo], ["등록일", formatDate(client.registeredAt)]].map(([label, value]) => (
                <div key={label} style={{ display: "flex", gap: "12px", padding: "8px 0", borderBottom: "1px solid #f1f5f9", alignItems: label === "메모" ? "flex-start" : "center" }}>
                  <span style={{ fontSize: "13px", color: "#94a3b8", width: "85px", flexShrink: 0, fontWeight: 600, paddingTop: label === "메모" ? "2px" : 0 }}>{label}</span>
                  {label === "컨설팅 종류" ? (
                    <ConsultBadge consultType={client.consultType} />
                  ) : label === "메모" ? (
                    <span style={{ fontSize: "14px", color: "#1a1a2e", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.6", flex: 1, maxHeight: "67.2px", overflowY: "auto", paddingRight: "4px" }}>{value || "-"}</span>
                  ) : (
                    <span style={{ fontSize: "14px", color: "#1a1a2e" }}>{value || "-"}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gap: "14px" }}>
              {[["name", "업체명"], ["type", "업종"], ["contact", "담당자"], ["phone", "연락처"], ["email", "이메일"], ["address", "주소"]].map(([key, label]) => (
                <div key={key}>
                  <label style={{ fontSize: "13px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>{label}</label>
                  <input value={editData[key] || ""} onChange={e => setEditData({ ...editData, [key]: e.target.value })} style={inputStyle} onFocus={e => e.target.style.borderColor = "#1a1a2e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: "13px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "6px" }}>컨설팅 종류</label>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {Object.entries(CONSULT_TYPES).map(([ct, cfg]) => (
                    <button key={ct} type="button" onClick={() => setEditData({ ...editData, consultType: ct })} style={{ padding: "8px 14px", borderRadius: "10px", border: editData.consultType === ct ? `2px solid ${cfg.color}` : "1px solid #e2e8f0", background: editData.consultType === ct ? cfg.bg : "white", color: editData.consultType === ct ? cfg.color : "#64748b", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                      {cfg.icon} {ct}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: "13px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>진행 상태</label>
                <select value={editData.status} onChange={e => setEditData({ ...editData, status: e.target.value })} style={{ ...inputStyle, appearance: "auto" }}>
                  {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "13px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>컨설팅 비용 (원)</label>
                  <input type="number" value={editData.consultFee || 0} onChange={e => setEditData({ ...editData, consultFee: Number(e.target.value) || 0 })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: "13px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>사후관리 비용 (원)</label>
                  <input type="number" value={editData.maintenanceFee || 0} onChange={e => setEditData({ ...editData, maintenanceFee: Number(e.target.value) || 0 })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "13px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>메모</label>
                <textarea value={editData.memo || ""} onChange={e => setEditData({ ...editData, memo: e.target.value })} rows={5} style={{ ...inputStyle, resize: "vertical" }} placeholder="엔터를 눌러 줄을 바꿀 수 있습니다" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Records Tab ── */}
      {activeTab === "records" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: 0 }}>상담 기록</h3>
            <button onClick={() => setShowRecordForm(!showRecordForm)} style={{ background: "#1a1a2e", color: "white", border: "none", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              {showRecordForm ? "취소" : "+ 기록 추가"}
            </button>
          </div>

          {showRecordForm && (
            <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "20px", marginBottom: "16px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>날짜</label>
                  <input type="date" value={newRecord.date} onChange={e => setNewRecord({ ...newRecord, date: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>유형</label>
                  <select value={newRecord.type} onChange={e => setNewRecord({ ...newRecord, type: e.target.value })} style={{ ...inputStyle, appearance: "auto" }}>
                    {Object.keys(RECORD_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>내용</label>
                <textarea value={newRecord.content} onChange={e => setNewRecord({ ...newRecord, content: e.target.value })} placeholder="상담 내용을 입력하세요...&#10;엔터를 눌러 줄을 바꿀 수 있습니다" rows={5} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <button onClick={handleSaveRecord} disabled={saving} style={{ background: "#0f766e", color: "white", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer", width: "100%", opacity: saving ? 0.6 : 1 }}>{saving ? "저장 중..." : "저장"}</button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {client.records.length === 0 && <p style={{ color: "#94a3b8", fontSize: "14px", textAlign: "center", padding: "32px 0" }}>아직 기록이 없습니다.</p>}
            {client.records.map((r) => (
              <div key={r.id} style={{ background: "white", borderRadius: "14px", border: editingRecordId === r.id ? "2px solid #1a1a2e" : "1px solid #e8ecf2", padding: "16px 20px" }}>
                {editingRecordId === r.id ? (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                      <div>
                        <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>날짜</label>
                        <input type="date" value={editRecordData.date} onChange={e => setEditRecordData({ ...editRecordData, date: e.target.value })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>유형</label>
                        <select value={editRecordData.type} onChange={e => setEditRecordData({ ...editRecordData, type: e.target.value })} style={{ ...inputStyle, appearance: "auto" }}>
                          {Object.keys(RECORD_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>내용</label>
                      <textarea value={editRecordData.content} onChange={e => setEditRecordData({ ...editRecordData, content: e.target.value })} rows={5} style={{ ...inputStyle, resize: "vertical" }} />
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={cancelEditRecord} style={{ flex: 1, padding: "9px", border: "1px solid #e2e8f0", borderRadius: "10px", background: "white", fontSize: "13px", cursor: "pointer", color: "#64748b", fontWeight: 600 }}>취소</button>
                      <button onClick={saveEditRecord} disabled={saving} style={{ flex: 1, padding: "9px", border: "none", borderRadius: "10px", background: "#0f766e", color: "white", fontSize: "13px", cursor: "pointer", fontWeight: 600, opacity: saving ? 0.6 : 1 }}>{saving ? "저장 중..." : "수정 완료"}</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                      <span style={{ fontSize: "18px" }}>{RECORD_TYPES[r.type] || "?"}</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a2e" }}>{r.type}</span>
                      <span style={{ fontSize: "12px", color: "#94a3b8", marginLeft: "auto" }}>{formatDate(r.date)}</span>
                      <button onClick={() => startEditRecord(r)} style={{ background: "#f1f5f9", border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", color: "#64748b", cursor: "pointer", fontWeight: 600, marginLeft: "4px" }}>수정</button>
                    </div>
                    <p style={{ fontSize: "14px", color: "#475569", margin: 0, lineHeight: "1.7", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "71.4px", overflowY: "auto", paddingRight: "4px" }}>{r.content}</p>
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
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 20px 0" }}>계약 / 매출 정보</h3>
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div style={{ background: "#ede9fe", borderRadius: "14px", padding: "18px" }}>
                <div style={{ fontSize: "12px", color: "#7c3aed", fontWeight: 600, marginBottom: "6px" }}>컨설팅 비용</div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#7c3aed" }}>{formatMoney(client.consultFee)}</div>
              </div>
              <div style={{ background: "#e0f2fe", borderRadius: "14px", padding: "18px" }}>
                <div style={{ fontSize: "12px", color: "#0284c7", fontWeight: 600, marginBottom: "6px" }}>정기 사후관리 비용</div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#0284c7" }}>{formatMoney(client.maintenanceFee)}</div>
              </div>
            </div>
            <div style={{ background: "linear-gradient(135deg, #0f766e, #14b8a6)", borderRadius: "14px", padding: "22px", color: "white" }}>
              <div style={{ fontSize: "13px", opacity: 0.8, marginBottom: "6px" }}>총 계약 금액</div>
              <div style={{ fontSize: "28px", fontWeight: 800 }}>{formatMoney(client.consultFee + client.maintenanceFee)}</div>
            </div>
            <div style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9", display: "flex", gap: "12px", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "#94a3b8", width: "85px", flexShrink: 0, fontWeight: 600 }}>진행 상태</span>
              <StatusBadge status={client.status} />
            </div>
            <div style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9", display: "flex", gap: "12px", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "#94a3b8", width: "85px", flexShrink: 0, fontWeight: 600 }}>컨설팅 종류</span>
              <ConsultBadge consultType={client.consultType} />
            </div>
            <div style={{ padding: "12px 0", display: "flex", gap: "12px" }}>
              <span style={{ fontSize: "13px", color: "#94a3b8", width: "85px", flexShrink: 0, fontWeight: 600 }}>등록일</span>
              <span style={{ fontSize: "14px", color: "#1a1a2e" }}>{formatDate(client.registeredAt)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── HACCP Tab ── */}
      {activeTab === "haccp" && (
        <HaccpManagement clientId={client.id} />
      )}
    </div>
  );
}

// ─── HACCP 관리 컴포넌트 ───
const HACCP_CATEGORIES = [
  { key: "haccp_education", label: "HACCP교육 수료", icon: "🎓" },
  { key: "hygiene_education", label: "위생교육", icon: "🧼" },
  { key: "validity_evaluation", label: "유효성평가", icon: "✅" },
  { key: "external_calibration", label: "계측기기 외부 검교정", icon: "🔧" },
  { key: "internal_calibration", label: "계측기기 자체검교정", icon: "⚙️" },
  { key: "water_test", label: "수질검사", icon: "💧" },
  { key: "self_evaluation", label: "자체평가", icon: "📊" },
  { key: "etc_note", label: "기타내용", icon: "📌" },
];

function HaccpManagement({ clientId }) {
  const [records, setRecords] = useState([]);
  const [waterConfig, setWaterConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openCategory, setOpenCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ item_name: "", record_date: "", memo: "" });

  // ── 데이터 로딩 ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: recs } = await supabase
      .from("haccp_records")
      .select("*")
      .eq("client_id", clientId)
      .order("record_date", { ascending: false });

    const { data: wc } = await supabase
      .from("water_test_config")
      .select("*")
      .eq("client_id", clientId)
      .single();

    setRecords(recs || []);
    setWaterConfig(wc || null);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── 기록 추가 ──
  const addRecord = async (category, itemName, recordDate, memo, file) => {
    setSaving(true);
    let fileUrl = "";
    let fileName = "";

    if (file) {
      const ext = file.name.split(".").pop();
      const path = `${clientId}/${category}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("haccp-files")
        .upload(path, file);
      if (!uploadErr) {
        const { data: urlData } = supabase.storage
          .from("haccp-files")
          .getPublicUrl(path);
        fileUrl = urlData.publicUrl;
        fileName = file.name;
      }
    }

    const { data, error } = await supabase
      .from("haccp_records")
      .insert([{ client_id: clientId, category, item_name: itemName, record_date: recordDate || null, memo, file_url: fileUrl, file_name: fileName }])
      .select()
      .single();

    if (!error && data) {
      setRecords(prev => [data, ...prev]);
    }
    setSaving(false);
    return !error;
  };

  // ── 기록 수정 ──
  const startEdit = (r) => {
    setEditingId(r.id);
    setEditData({ item_name: r.item_name || "", record_date: r.record_date || "", memo: r.memo || "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({ item_name: "", record_date: "", memo: "" });
  };

  const saveEdit = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("haccp_records")
      .update({ item_name: editData.item_name, record_date: editData.record_date || null, memo: editData.memo })
      .eq("id", editingId)
      .select()
      .single();

    if (!error && data) {
      setRecords(prev => prev.map(r => r.id === editingId ? { ...r, ...data } : r));
    }
    setEditingId(null);
    setEditData({ item_name: "", record_date: "", memo: "" });
    setSaving(false);
  };

  // ── 기록 삭제 ──
  const deleteRecord = async (id) => {
    const { error } = await supabase.from("haccp_records").delete().eq("id", id);
    if (!error) setRecords(prev => prev.filter(r => r.id !== id));
  };

  // ── 수질검사 타입 설정 ──
  const setWaterType = async (type) => {
    if (waterConfig) {
      await supabase.from("water_test_config").update({ water_type: type }).eq("id", waterConfig.id);
      setWaterConfig({ ...waterConfig, water_type: type });
    } else {
      const { data } = await supabase.from("water_test_config").insert([{ client_id: clientId, water_type: type }]).select().single();
      if (data) setWaterConfig(data);
    }
  };

  const inputStyle = { width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: "10px", fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  if (loading) return <LoadingSpinner message="HACCP 데이터 로딩 중..." />;

  return (
    <div>
      <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 16px 0" }}>HACCP 관리</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {HACCP_CATEGORIES.map(cat => {
          const catRecords = records.filter(r => r.category === cat.key);
          const isOpen = openCategory === cat.key;
          const needsItemName = ["validity_evaluation", "external_calibration", "internal_calibration"].includes(cat.key);

          return (
            <div key={cat.key} style={{ background: "white", borderRadius: "14px", border: isOpen ? "2px solid #1a1a2e" : "1px solid #e8ecf2", overflow: "hidden" }}>
              {/* 카테고리 헤더 */}
              <div onClick={() => setOpenCategory(isOpen ? null : cat.key)} style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}>{cat.icon}</span>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a2e", flex: 1 }}>{cat.label}</span>
                <span style={{ fontSize: "12px", color: "#94a3b8", background: "#f1f5f9", padding: "2px 10px", borderRadius: "10px" }}>{catRecords.length}건</span>
                <span style={{ fontSize: "14px", color: "#94a3b8", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
              </div>

              {/* 카테고리 내용 */}
              {isOpen && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f1f5f9" }}>
                  {/* 수질검사 타입 선택 */}
                  {cat.key === "water_test" && (
                    <div style={{ padding: "14px 0", borderBottom: "1px solid #f1f5f9", marginBottom: "12px" }}>
                      <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, marginBottom: "8px" }}>수질 유형</div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {["상수도", "지하수"].map(t => (
                          <button key={t} onClick={() => setWaterType(t)} style={{ padding: "8px 18px", borderRadius: "10px", border: (waterConfig?.water_type || "상수도") === t ? "2px solid #0284c7" : "1px solid #e2e8f0", background: (waterConfig?.water_type || "상수도") === t ? "#e0f2fe" : "white", color: (waterConfig?.water_type || "상수도") === t ? "#0284c7" : "#64748b", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>{t}</button>
                        ))}
                      </div>
                      {(waterConfig?.water_type || "상수도") === "상수도" && (
                        <div style={{ marginTop: "10px", fontSize: "13px", color: "#64748b", background: "#f8fafc", padding: "10px 14px", borderRadius: "10px" }}>상수도는 별도 검사일자 기록이 필요하지 않습니다.</div>
                      )}
                    </div>
                  )}

                  {/* 기록 추가 폼 */}
                  {!(cat.key === "water_test" && (waterConfig?.water_type || "상수도") === "상수도") && (
                    <HaccpRecordForm category={cat.key} onAdd={addRecord} saving={saving} inputStyle={inputStyle} />
                  )}

                  {/* 기록 목록 */}
                  <div style={{ maxHeight: catRecords.length > 3 ? "280px" : "auto", overflowY: catRecords.length > 3 ? "auto" : "visible", marginTop: "12px" }}>
                    {catRecords.length === 0 && <p style={{ color: "#94a3b8", fontSize: "13px", textAlign: "center", padding: "16px 0" }}>등록된 기록이 없습니다.</p>}
                    {catRecords.map(r => (
                      <div key={r.id} style={{ padding: "12px", borderRadius: "10px", background: editingId === r.id ? "#fff" : "#f8fafc", border: editingId === r.id ? "2px solid #1a1a2e" : "1px solid transparent", marginBottom: "8px" }}>
                        {editingId === r.id ? (
                          /* ── 수정 모드 ── */
                          <div style={{ display: "grid", gap: "10px" }}>
                            {needsItemName && (
                              <div>
                                <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>항목명</label>
                                <input value={editData.item_name} onChange={e => setEditData({ ...editData, item_name: e.target.value })} style={inputStyle} />
                              </div>
                            )}
                            <div>
                              <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>날짜</label>
                              <input type="date" value={editData.record_date} onChange={e => setEditData({ ...editData, record_date: e.target.value })} style={inputStyle} />
                            </div>
                            <div>
                              <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>메모</label>
                              <textarea value={editData.memo} onChange={e => setEditData({ ...editData, memo: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                            </div>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button onClick={cancelEdit} style={{ flex: 1, padding: "9px", border: "1px solid #e2e8f0", borderRadius: "10px", background: "white", fontSize: "13px", cursor: "pointer", color: "#64748b", fontWeight: 600 }}>취소</button>
                              <button onClick={saveEdit} disabled={saving} style={{ flex: 1, padding: "9px", border: "none", borderRadius: "10px", background: "#0f766e", color: "white", fontSize: "13px", cursor: "pointer", fontWeight: 600, opacity: saving ? 0.6 : 1 }}>{saving ? "저장 중..." : "수정 완료"}</button>
                            </div>
                          </div>
                        ) : (
                          /* ── 보기 모드 ── */
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {r.item_name && <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a2e", marginBottom: "2px" }}>{r.item_name}</div>}
                              {r.record_date && <div style={{ fontSize: "12px", color: "#64748b" }}>{formatDate(r.record_date)}</div>}
                              {r.memo && <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px", whiteSpace: "pre-wrap" }}>{r.memo}</div>}
                              {r.file_url && (
                                <a href={r.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#3b82f6", marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "4px", textDecoration: "none", background: "#eff6ff", padding: "4px 10px", borderRadius: "6px" }}>
                                  📎 {r.file_name || "첨부파일 보기"}
                                </a>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                              <button onClick={() => startEdit(r)} style={{ background: "#f1f5f9", border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", color: "#64748b", cursor: "pointer", fontWeight: 600 }}>수정</button>
                              <button onClick={() => deleteRecord(r.id)} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "16px", cursor: "pointer", padding: "2px 6px" }}>✕</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── HACCP 기록 추가 폼 ───
function HaccpRecordForm({ category, onAdd, saving, inputStyle }) {
  const [itemName, setItemName] = useState("");
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split("T")[0]);
  const [memo, setMemo] = useState("");
  const [file, setFile] = useState(null);

  const needsItemName = ["validity_evaluation", "external_calibration", "internal_calibration", "etc_note"].includes(category);
  const isEtcNote = category === "etc_note";
  const itemLabel = category === "validity_evaluation" ? "CCP명 (예: CCP1-가열)" :
    category === "external_calibration" ? "계측기기명" :
    category === "internal_calibration" ? "계측기기명" :
    category === "etc_note" ? "제목" : "";

  const handleSubmit = async () => {
    if (needsItemName && !itemName.trim()) return alert(isEtcNote ? "제목을 입력해주세요." : "항목명을 입력해주세요.");
    if (isEtcNote && !memo.trim()) return alert("내용을 입력해주세요.");
    const success = await onAdd(category, itemName, isEtcNote ? null : recordDate, memo, file);
    if (success) {
      setItemName("");
      setRecordDate(new Date().toISOString().split("T")[0]);
      setMemo("");
      setFile(null);
    }
  };

  return (
    <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px", marginTop: "12px", border: "1px solid #e2e8f0" }}>
      <div style={{ display: "grid", gap: "10px" }}>
        {needsItemName && (
          <div>
            <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>{itemLabel}</label>
            <input value={itemName} onChange={e => setItemName(e.target.value)} style={inputStyle} placeholder={itemLabel} />
          </div>
        )}
        {!isEtcNote && (
          <div>
            <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>날짜</label>
            <input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} style={inputStyle} />
          </div>
        )}
        <div>
          <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>{isEtcNote ? "내용" : "메모"}</label>
          <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={isEtcNote ? 5 : 2} style={{ ...inputStyle, resize: "vertical" }} placeholder={isEtcNote ? "내용을 입력하세요..." : "메모 입력 (선택)"} />
        </div>
        <div>
          <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>파일 첨부</label>
          <input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files[0] || null)} style={{ fontSize: "13px", color: "#64748b" }} />
          {file && <div style={{ fontSize: "12px", color: "#3b82f6", marginTop: "4px" }}>📎 {file.name}</div>}
        </div>
        <button onClick={handleSubmit} disabled={saving} style={{ background: "#0f766e", color: "white", border: "none", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1, width: "100%" }}>
          {saving ? "저장 중..." : "+ 추가"}
        </button>
      </div>
    </div>
  );
}

// ─── 거래처 추가 모달 ───
function AddClientModal({ onClose, onSave, saving }) {
  const [form, setForm] = useState({ name: "", contact: "", phone: "", email: "", address: "", type: "", consultType: "신규인증", status: "상담중", consultFee: 0, maintenanceFee: 0, memo: "" });
  const inputStyle = { width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: "10px", fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  const handleSave = () => {
    if (!form.name.trim()) return alert("업체명을 입력해주세요.");
    onSave({ ...form, consultFee: Number(form.consultFee) || 0, maintenanceFee: Number(form.maintenanceFee) || 0 });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "460px", maxHeight: "85vh", overflow: "auto" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 20px 0" }}>새 거래처 추가</h3>
        <div style={{ display: "grid", gap: "14px" }}>
          {[["name", "업체명 *"], ["type", "업종 (예: 식품제조, 수산유통)"], ["contact", "담당자"], ["phone", "연락처"], ["email", "이메일"], ["address", "주소"]].map(([key, label]) => (
            <div key={key}>
              <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>{label}</label>
              <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle} placeholder={label.replace(" *", "")} onFocus={e => e.target.style.borderColor = "#1a1a2e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "6px" }}>컨설팅 종류</label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {Object.entries(CONSULT_TYPES).map(([ct, cfg]) => (
                <button key={ct} type="button" onClick={() => setForm({ ...form, consultType: ct })} style={{ padding: "8px 14px", borderRadius: "10px", border: form.consultType === ct ? `2px solid ${cfg.color}` : "1px solid #e2e8f0", background: form.consultType === ct ? cfg.bg : "white", color: form.consultType === ct ? cfg.color : "#64748b", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                  {cfg.icon} {ct}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>진행 상태</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ ...inputStyle, appearance: "auto" }}>
              {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>컨설팅 비용 (원)</label>
              <input type="number" value={form.consultFee} onChange={e => setForm({ ...form, consultFee: e.target.value })} style={inputStyle} placeholder="0" />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>사후관리 비용 (원)</label>
              <input type="number" value={form.maintenanceFee} onChange={e => setForm({ ...form, maintenanceFee: e.target.value })} style={inputStyle} placeholder="0" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>메모</label>
            <textarea value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="추가 정보...&#10;엔터를 눌러 줄을 바꿀 수 있습니다" />
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: "12px", background: "white", fontSize: "14px", cursor: "pointer", color: "#64748b" }}>취소</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "12px", border: "none", borderRadius: "12px", background: "#1a1a2e", color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "추가 중..." : "추가"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── 로그인 화면 ───
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) return setError("이메일과 비밀번호를 입력해주세요.");
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("로그인 실패: 이메일 또는 비밀번호를 확인해주세요.");
      setLoading(false);
    }
    // onAuthStateChange가 처리함
  };

  const inputStyle = { width: "100%", padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "15px", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6fa", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "'Noto Sans KR', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ background: "white", borderRadius: "24px", padding: "40px 32px", width: "100%", maxWidth: "400px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>🏢</div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#1a1a2e", margin: "0 0 4px 0" }}>거래처 관리</h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>HACCP 컨설팅</p>
        </div>
        <div style={{ display: "grid", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "13px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "6px" }}>이메일</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="이메일 입력" onKeyDown={e => e.key === "Enter" && handleLogin()} onFocus={e => e.target.style.borderColor = "#1a1a2e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
          </div>
          <div>
            <label style={{ fontSize: "13px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "6px" }}>비밀번호</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="비밀번호 입력" onKeyDown={e => e.key === "Enter" && handleLogin()} onFocus={e => e.target.style.borderColor = "#1a1a2e"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
          </div>
          {error && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontSize: "13px" }}>{error}</div>}
          <button onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: "14px", background: "#1a1a2e", color: "white", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 앱 ───
export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => setToast({ message, type });

  // ── 인증 상태 감시 ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── DB에서 거래처 + 상담기록 전부 읽어오기 ──
  const fetchClients = useCallback(async () => {
    setLoading(true);
    // 거래처 가져오기
    const { data: clientRows, error: clientErr } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (clientErr) {
      console.error("거래처 로딩 실패:", clientErr);
      showToast("거래처 데이터를 불러오지 못했습니다.", "error");
      setLoading(false);
      return;
    }

    // 상담 기록 가져오기
    const { data: recordRows, error: recordErr } = await supabase
      .from("records")
      .select("*")
      .order("date", { ascending: false });

    if (recordErr) {
      console.error("상담기록 로딩 실패:", recordErr);
    }

    // 거래처별로 기록 묶기
    const recordsByClient = {};
    (recordRows || []).forEach(r => {
      if (!recordsByClient[r.client_id]) recordsByClient[r.client_id] = [];
      recordsByClient[r.client_id].push(r);
    });

    const merged = (clientRows || []).map(row => dbToClient(row, recordsByClient[row.id] || []));
    setClients(merged);
    setLoading(false);
  }, []);

  // ── 로그인 후 데이터 불러오기 ──
  useEffect(() => {
    if (session) fetchClients();
  }, [session, fetchClients]);

  const navigate = (v, id) => { setView(v); if (id) setSelectedId(id); };
  const selectedClient = clients.find(c => c.id === selectedId);

  // ── 거래처 추가 (DB에 저장) ──
  const handleAddClient = async (formData) => {
    setSaving(true);
    const dbData = clientToDb(formData);
    dbData.registered_at = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("clients")
      .insert([dbData])
      .select()
      .single();

    if (error) {
      console.error("거래처 추가 실패:", error);
      showToast("거래처 추가에 실패했습니다.", "error");
      setSaving(false);
      return;
    }

    // 새 거래처를 목록 맨 앞에 추가 (새로고침 없이)
    const newClient = dbToClient(data, []);
    setClients(prev => [newClient, ...prev]);
    setShowAddModal(false);
    showToast(`"${data.name}" 거래처가 추가되었습니다.`);
    setSaving(false);
  };

  // ── 거래처 수정 (DB에 저장) ──
  const handleUpdateClient = async (id, editData) => {
    const dbData = clientToDb(editData);

    const { data, error } = await supabase
      .from("clients")
      .update(dbData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("거래처 수정 실패:", error);
      showToast("거래처 수정에 실패했습니다.", "error");
      return;
    }

    // 화면 즉시 반영 (새로고침 없이)
    setClients(prev => prev.map(c => {
      if (c.id !== id) return c;
      return dbToClient(data, c.records.map(r => ({
        id: r.id, client_id: id, date: r.date, type: r.type, content: r.content
      })));
    }));
    showToast("거래처 정보가 수정되었습니다.");
  };

  // ── 상담 기록 추가 (DB에 저장) ──
  const handleAddRecord = async (clientId, recordData) => {
    const { data, error } = await supabase
      .from("records")
      .insert([{
        client_id: clientId,
        date: recordData.date,
        type: recordData.type,
        content: recordData.content,
      }])
      .select()
      .single();

    if (error) {
      console.error("기록 추가 실패:", error);
      showToast("상담 기록 추가에 실패했습니다.", "error");
      return;
    }

    // 화면 즉시 반영
    const newRecord = { id: data.id, date: data.date, type: data.type, content: data.content };
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, records: [newRecord, ...c.records] };
    }));
    showToast("상담 기록이 추가되었습니다.");
  };

  // ── 상담 기록 수정 (DB에 저장) ──
  const handleUpdateRecord = async (clientId, recordId, updatedData) => {
    const { data, error } = await supabase
      .from("records")
      .update({
        date: updatedData.date,
        type: updatedData.type,
        content: updatedData.content,
      })
      .eq("id", recordId)
      .select()
      .single();

    if (error) {
      console.error("기록 수정 실패:", error);
      showToast("상담 기록 수정에 실패했습니다.", "error");
      return;
    }

    // 화면 즉시 반영
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return {
        ...c,
        records: c.records.map(r => r.id === recordId ? { id: data.id, date: data.date, type: data.type, content: data.content } : r),
      };
    }));
    showToast("상담 기록이 수정되었습니다.");
  };

  // ── 거래처 삭제 (DB에서 삭제) ──
  const handleDeleteClient = async (id) => {
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("거래처 삭제 실패:", error);
      showToast("거래처 삭제에 실패했습니다.", "error");
      return;
    }

    setClients(prev => prev.filter(c => c.id !== id));
    setView("list");
    showToast("거래처가 삭제되었습니다.");
  };

  // ── 로그아웃 ──
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setClients([]);
    setView("dashboard");
  };

  // ── 로딩 / 로그인 분기 ──
  if (authLoading) {
    return <div style={{ minHeight: "100vh", background: "#f4f6fa", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR', sans-serif" }}><LoadingSpinner message="인증 확인 중..." /></div>;
  }

  if (!session) {
    return <LoginScreen />;
  }

  const navItems = [
    { key: "dashboard", label: "대시보드", icon: "📊" },
    { key: "list", label: "거래처", icon: "🏢" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6fa", fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* 토스트 알림 */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* 상단 헤더 */}
      <div style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", padding: "16px 24px", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px" }}>🏢</span>
          <span style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "-0.3px" }}>거래처 관리</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "12px", opacity: 0.6 }}>{session.user.email}</span>
          <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", padding: "6px 12px", color: "white", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}>로그아웃</button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ display: "flex", gap: "4px", padding: "12px 16px", background: "white", borderBottom: "1px solid #e8ecf2" }}>
        {navItems.map(item => (
          <button key={item.key} onClick={() => navigate(item.key)} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: view === item.key || (view === "detail" && item.key === "list") ? "#1a1a2e" : "transparent", color: view === item.key || (view === "detail" && item.key === "list") ? "white" : "#64748b", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      {/* 메인 콘텐츠 */}
      <div style={{ padding: "20px 16px", maxWidth: "680px", margin: "0 auto" }}>
        {loading ? (
          <LoadingSpinner message="거래처 데이터를 불러오는 중..." />
        ) : (
          <>
            {view === "dashboard" && <Dashboard clients={clients} onNavigate={navigate} />}
            {view === "list" && <ClientList clients={clients} onNavigate={navigate} onAdd={() => setShowAddModal(true)} />}
            {view === "detail" && <ClientDetail client={selectedClient} onBack={() => navigate("list")} onUpdate={handleUpdateClient} onAddRecord={handleAddRecord} onUpdateRecord={handleUpdateRecord} onDelete={handleDeleteClient} />}
          </>
        )}
      </div>

      {/* 거래처 추가 모달 */}
      {showAddModal && <AddClientModal onClose={() => setShowAddModal(false)} onSave={handleAddClient} saving={saving} />}
    </div>
  );
}

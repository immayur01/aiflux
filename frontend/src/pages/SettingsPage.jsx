import React, { useState, useEffect } from 'react';
import { Settings, HardDrive, Activity, Shield, Save } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatBytes, formatDate } from '../utils/fileUtils.jsx';

export default function SettingsPage() {
  const toast = useToast();
  const [storage, setStorage] = useState(null);
  const [quotaMb, setQuotaMb] = useState('');
  const [activityLog, setActivityLog] = useState([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('storage');

  useEffect(() => {
    loadStorage();
    loadLog();
  }, []);

  const loadStorage = async () => {
    try {
      const [storageRes, settingsRes] = await Promise.all([
        api.get('/files/storage-info'),
        api.get('/settings'),
      ]);
      setStorage(storageRes.data);
      setQuotaMb(String(Math.round(Number(settingsRes.data.max_storage_bytes) / 1024 / 1024)));
    } catch {}
  };

  const loadLog = async () => {
    try {
      const res = await api.get('/settings/activity-log');
      setActivityLog(res.data);
    } catch {}
  };

  const saveQuota = async () => {
    const mb = Number(quotaMb);
    if (isNaN(mb) || mb < 1) return toast.error('Invalid quota value');
    setSaving(true);
    try {
      await api.patch('/settings', { max_storage_mb: mb });
      await loadStorage();
      toast.success(`Quota updated to ${mb} MB`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const storagePercent = storage?.percentUsed || 0;
  const storageColor = storagePercent >= 90 ? 'danger' : storagePercent >= 70 ? 'warn' : '';

  const tabs = [
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'activity', label: 'Activity Log', icon: Activity },
    { id: 'security', label: 'Security & Cloud', icon: Shield },
  ];

  const actionColors = {
    LOGIN_SUCCESS: 'var(--success)',
    LOGIN_FAIL: 'var(--danger)',
    LOGIN_LOCKED: 'var(--danger)',
    LOGOUT: 'var(--text-muted)',
    FILE_UPLOAD: 'var(--accent-light)',
    FILE_DOWNLOAD: 'var(--info)',
    FILE_DELETE: 'var(--danger)',
    FILE_RENAME: 'var(--warning)',
    FOLDER_CREATE: 'var(--accent-light)',
    FOLDER_DELETE: 'var(--danger)',
    PASSWORD_RESET: 'var(--warning)',
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-title">
          <Settings size={24} color="var(--accent-light)" />
          <h2>Settings</h2>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'1px solid var(--border)', paddingBottom:0 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'8px 16px', background:'none', border:'none',
              cursor:'pointer', fontFamily:'inherit', fontSize:'0.875rem', fontWeight:600,
              color: activeTab === tab.id ? 'var(--accent-light)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom:-1, transition:'all 0.15s',
            }}>
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Storage Tab */}
      {activeTab === 'storage' && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {storage && (
            <div className="card">
              <h3 style={{ marginBottom:20 }}>Storage Usage</h3>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                <span className="text-secondary">{formatBytes(storage.usedBytes)} used</span>
                <span style={{ fontWeight:700 }}>{formatBytes(storage.quotaBytes)} total</span>
              </div>
              <div className="progress-bar-track" style={{ height:10, marginBottom:8 }}>
                <div className={`progress-bar-fill ${storageColor}`}
                  style={{ width:`${Math.min(storagePercent, 100)}%` }} />
              </div>
              <div className="text-secondary text-sm">{storagePercent}% used</div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginTop:24 }}>
                {[
                  { label:'Used', value: formatBytes(storage.usedBytes), color:'var(--accent-light)' },
                  { label:'Available', value: formatBytes(storage.quotaBytes - storage.usedBytes), color:'var(--success)' },
                  { label:'Quota', value: formatBytes(storage.quotaBytes), color:'var(--text-primary)' },
                ].map(s => (
                  <div key={s.label} style={{ background:'var(--bg-elevated)', padding:'14px 16px',
                    borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontWeight:700, fontSize:'1.1rem', color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h3 style={{ marginBottom:16 }}>Storage Quota</h3>
            <p className="text-secondary text-sm mb-4">
              Set the maximum total storage allowed across Firebase Cloud Storage. Files exceeding this limit will be rejected.
            </p>
            <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
              <div className="form-group" style={{ flex:1 }}>
                <label className="form-label">Max Storage (MB)</label>
                <input className="input" type="number" min="1" max="1000000"
                  value={quotaMb} onChange={e => setQuotaMb(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={saveQuota} disabled={saving}>
                <Save size={15} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Log Tab */}
      {activeTab === 'activity' && (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
            <h3>Activity Log (Supabase)</h3>
            <p className="text-secondary text-sm">Real-time system events logged to Supabase PostgreSQL</p>
          </div>
          <div style={{ maxHeight:600, overflow:'auto' }}>
            {activityLog.length === 0 ? (
              <div className="empty-state" style={{ padding:40 }}>No activity recorded in Supabase yet</div>
            ) : activityLog.map(entry => (
              <div key={entry.id} style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)',
                display:'flex', alignItems:'center', gap:12 }}>
                <span style={{
                  fontSize:'0.7rem', fontWeight:700, padding:'2px 8px', borderRadius:99,
                  background:'rgba(255,255,255,0.05)',
                  color: actionColors[entry.action] || 'var(--text-secondary)',
                  whiteSpace:'nowrap',
                }}>
                  {entry.action}
                </span>
                <span style={{ flex:1, fontSize:'0.875rem', color:'var(--text-secondary)' }}>
                  {entry.detail}
                </span>
                <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                  {formatDate(entry.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="card">
          <h3 style={{ marginBottom:16 }}>Architecture & Security</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[
              { label:'Authentication Provider', value:'Supabase Auth (GoTrue JWT Tokens)', ok:true },
              { label:'Token Verification', value:'Supabase GoTrue JWT cryptographically verified', ok:true },
              { label:'Cloud Database', value:'Supabase PostgreSQL (Enterprise Relational DB)', ok:true },
              { label:'File Storage', value:'Supabase Storage (1 GB Free Bucket / Local hybrid)', ok:true },
              { label:'Brute Force Protection', value:'Supabase Auth rate-limiting & password policies', ok:true },
              { label:'Password Reset Flow', value:'Supabase email reset with time-limited token', ok:true },
              { label:'Sanitization', value:'MIME type inspection & filename sanitization', ok:true },
            ].map(item => (
              <div key={item.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'12px 14px', background:'var(--bg-elevated)', borderRadius:'var(--radius-md)',
                border:'1px solid var(--border)' }}>
                <span style={{ fontSize:'0.875rem', fontWeight:500 }}>{item.label}</span>
                <span style={{ fontSize:'0.8125rem', color: item.ok ? 'var(--success)' : 'var(--danger)', fontWeight:600 }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Home, FolderOpen, Settings, LogOut,
  ChevronRight, ChevronDown, Plus, Cloud, HardDrive,
  Menu, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api from '../api/client.js';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FolderTreeItem({ folder, depth = 0, activeId, onNavigate }) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = folder.children?.length > 0;
  const isActive = folder.id === activeId;

  return (
    <div>
      <button
        className={`nav-item ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
        onClick={() => { onNavigate(folder.id); if (hasChildren) setOpen(o => !o); }}
      >
        {hasChildren
          ? (open ? <ChevronDown size={14} className="nav-item-icon" /> : <ChevronRight size={14} className="nav-item-icon" />)
          : <span style={{ width: 14 }} />
        }
        <FolderOpen size={15} className="nav-item-icon" />
        <span className="nav-item-name">{folder.name}</span>
      </button>
      {open && hasChildren && (
        <div className="nav-folder-children">
          {folder.children.map(child => (
            <FolderTreeItem key={child.id} folder={child} depth={depth + 1} activeId={activeId} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [folders, setFolders] = useState([]);
  const [storage, setStorage] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeFolderId = location.pathname.startsWith('/folder/')
    ? location.pathname.replace('/folder/', '')
    : null;

  const loadFolders = useCallback(async () => {
    try {
      const res = await api.get('/folders');
      setFolders(res.data);
    } catch {}
  }, []);

  const loadStorage = useCallback(async () => {
    try {
      const res = await api.get('/files/storage-info');
      setStorage(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    loadFolders();
    loadStorage();
  }, [location.pathname, loadFolders, loadStorage]);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    toast.info('Logged out successfully');
  };

  const storagePercent = storage?.percentUsed || 0;
  const storageColor = storagePercent >= 90 ? 'danger' : storagePercent >= 70 ? 'warn' : '';

  return (
    <div className="app-layout">
      {/* ── Mobile Top Header Bar ── */}
      <header className="mobile-header">
        <button
          className="mobile-menu-trigger"
          onClick={() => setMobileMenuOpen(o => !o)}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className="mobile-header-brand" onClick={() => navigate('/')}>
          <div className="logo-icon small">
            <Cloud size={15} color="#fff" />
          </div>
          <span className="logo-text">Flux</span>
        </div>

        <button
          className="mobile-header-action"
          onClick={() => navigate('/settings')}
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </header>

      {/* ── Mobile Backdrop Overlay ── */}
      {mobileMenuOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar (Desktop Fixed + Mobile Slide-In Drawer) ── */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Cloud size={18} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="logo-text">Flux</div>
            <div className="logo-sub">Personal Cloud</div>
          </div>
          {/* Close button inside drawer for mobile */}
          <button
            className="mobile-drawer-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          <button className={`nav-item ${location.pathname === '/' ? 'active' : ''}`} onClick={() => navigate('/')}>
            <Home size={16} className="nav-item-icon" />
            <span className="nav-item-name">Dashboard</span>
          </button>

          <div className="nav-section-label" style={{ marginTop: 12 }}>Folders</div>
          {folders.map(f => (
            <FolderTreeItem
              key={f.id}
              folder={f}
              activeId={activeFolderId}
              onNavigate={id => navigate(`/folder/${id}`)}
            />
          ))}
        </nav>

        {/* Storage widget */}
        {storage && (
          <div className="storage-widget">
            <div className="storage-label">
              <span style={{ display:'flex', alignItems:'center', gap:4 }}><HardDrive size={12} /> Storage</span>
              <span>{formatBytes(storage.usedBytes)} / {formatBytes(storage.quotaBytes)}</span>
            </div>
            <div className="progress-bar-track">
              <div className={`progress-bar-fill ${storageColor}`} style={{ width: `${Math.min(storagePercent, 100)}%` }} />
            </div>
            <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:4 }}>{storagePercent}% used</div>
          </div>
        )}

        <div className="sidebar-footer">
          <button className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`} onClick={() => navigate('/settings')}>
            <Settings size={16} className="nav-item-icon" />
            <span className="nav-item-name">Settings</span>
          </button>
          <button className="nav-item" onClick={handleLogout}>
            <LogOut size={16} className="nav-item-icon" />
            <span className="nav-item-name">Log out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content">
        <Outlet context={{ reloadFolders: loadFolders, reloadStorage: loadStorage }} />
      </main>
    </div>
  );
}

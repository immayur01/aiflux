import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Plus, FolderOpen, Pencil, Trash2, FolderPlus } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import Modal from '../components/Modal.jsx';

const FOLDER_EMOJIS = ['📁', '💻', '🖥️', '📂', '🗂️', '📦', '🔧', '🎵', '📸', '🎬', '📚', '🔑'];

function getFolderEmoji(name) {
  const n = name.toLowerCase();
  if (n.includes('software') || n.includes('app')) return '💻';
  if (n.includes('os') || n.includes('operating')) return '🖥️';
  if (n.includes('code') || n.includes('project')) return '⚙️';
  if (n.includes('photo') || n.includes('image') || n.includes('pic')) return '📸';
  if (n.includes('video') || n.includes('movie')) return '🎬';
  if (n.includes('music') || n.includes('audio')) return '🎵';
  if (n.includes('doc') || n.includes('book')) return '📚';
  if (n.includes('backup')) return '🔒';
  return '📁';
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { reloadFolders } = useOutletContext() || {};
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showRename, setShowRename] = useState(null);
  const [showDelete, setShowDelete] = useState(null);
  const [folderName, setFolderName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/folders');
      setFolders(res.data);
    } catch {
      toast.error('Failed to load folders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createFolder = async () => {
    if (!folderName.trim()) return;
    setSaving(true);
    try {
      await api.post('/folders', { name: folderName.trim() });
      toast.success(`Folder "${folderName}" created`);
      setShowCreate(false);
      setFolderName('');
      load();
      reloadFolders?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create folder');
    } finally { setSaving(false); }
  };

  const renameFolder = async () => {
    if (!folderName.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/folders/${showRename.id}`, { name: folderName.trim() });
      toast.success('Folder renamed');
      setShowRename(null);
      setFolderName('');
      load();
      reloadFolders?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to rename');
    } finally { setSaving(false); }
  };

  const deleteFolder = async () => {
    setSaving(true);
    try {
      await api.delete(`/folders/${showDelete.id}`);
      toast.success(`Folder "${showDelete.name}" deleted`);
      setShowDelete(null);
      load();
      reloadFolders?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    } finally { setSaving(false); }
  };

  // Flatten tree for dashboard display (only top-level)
  const topLevelFolders = folders;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-title">
          <h1 style={{ fontSize:'1.5rem' }}>Dashboard</h1>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => { setFolderName(''); setShowCreate(true); }}>
            <FolderPlus size={16} /> New Folder
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" style={{ width:32, height:32 }} /></div>
      ) : topLevelFolders.length === 0 ? (
        <div className="empty-state">
          <FolderOpen size={56} className="empty-state-icon" />
          <h3>No folders yet</h3>
          <p>Create your first folder to get started</p>
          <button className="btn btn-primary" style={{ marginTop:8 }} onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create Folder
          </button>
        </div>
      ) : (
        <div className="folder-grid">
          {topLevelFolders.map(f => (
            <div key={f.id} className="folder-card" onClick={() => navigate(`/folder/${f.id}`)}>
              <div className="folder-card-actions" onClick={e => e.stopPropagation()}>
                <button className="btn-icon" title="Rename" onClick={() => { setShowRename(f); setFolderName(f.name); }}>
                  <Pencil size={13} />
                </button>
                <button className="btn-icon" title="Delete" style={{ color:'var(--danger)' }}
                  onClick={() => setShowDelete(f)}>
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="folder-card-icon">{getFolderEmoji(f.name)}</div>
              <div className="folder-card-name">{f.name}</div>
              {f.children?.length > 0 && (
                <div className="folder-card-meta">{f.children.length} subfolder{f.children.length !== 1 ? 's' : ''}</div>
              )}
            </div>
          ))}

          {/* Add folder card */}
          <div className="folder-card" style={{ border:'2px dashed var(--border)', cursor:'pointer', opacity:0.6 }}
            onClick={() => { setFolderName(''); setShowCreate(true); }}>
            <Plus size={28} color="var(--text-muted)" />
            <div className="folder-card-name" style={{ color:'var(--text-muted)' }}>New Folder</div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Create New Folder" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label className="form-label">Folder Name</label>
            <input className="input" placeholder="e.g. Documents" autoFocus
              value={folderName} onChange={e => setFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createFolder()} />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={createFolder} disabled={saving || !folderName.trim()}>
              {saving ? <span className="spinner" style={{ width:14, height:14 }} /> : null} Create
            </button>
          </div>
        </Modal>
      )}

      {/* Rename Modal */}
      {showRename && (
        <Modal title="Rename Folder" onClose={() => setShowRename(null)}>
          <div className="form-group">
            <label className="form-label">New Name</label>
            <input className="input" autoFocus
              value={folderName} onChange={e => setFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && renameFolder()} />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setShowRename(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={renameFolder} disabled={saving || !folderName.trim()}>
              {saving ? <span className="spinner" style={{ width:14, height:14 }} /> : null} Rename
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {showDelete && (
        <Modal title="Delete Folder" onClose={() => setShowDelete(null)}>
          <p style={{ color:'var(--text-secondary)', marginBottom:4 }}>
            Delete <strong style={{ color:'var(--text-primary)' }}>"{showDelete.name}"</strong>?
          </p>
          <p style={{ fontSize:'0.875rem', color:'var(--danger)' }}>
            This will permanently delete all files inside. This cannot be undone.
          </p>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setShowDelete(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={deleteFolder} disabled={saving}>
              {saving ? <span className="spinner" style={{ width:14, height:14 }} /> : null} Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

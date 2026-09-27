import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ChevronRight, Home, Upload, FolderPlus, Grid, List,
  Download, Trash2, Pencil, Eye, Move, MoreVertical,
  FolderOpen
} from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { getFileIcon, formatBytes, formatDate, isPreviewable } from '../utils/fileUtils.jsx';
import DropZone from '../components/DropZone.jsx';
import Modal from '../components/Modal.jsx';
import FilePreviewModal from '../components/FilePreviewModal.jsx';

export default function FolderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { reloadFolders, reloadStorage } = useOutletContext() || {};

  const [folder, setFolder] = useState(null);
  const [files, setFiles] = useState([]);
  const [subfolders, setSubfolders] = useState([]);
  const [allFolders, setAllFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveFolderId, setMoveFolderId] = useState('');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [folderRes, filesRes, allFoldersRes] = await Promise.all([
        api.get(`/folders/${id}`),
        api.get(`/files?folderId=${id}`),
        api.get('/folders'),
      ]);
      setFolder(folderRes.data);
      setFiles(filesRes.data);
      setAllFolders(flattenFolders(allFoldersRes.data));
      // Subfolders from allFolders where parent_id === id
      const flat = flattenFolders(allFoldersRes.data);
      setSubfolders(flat.filter(f => f.parent_id === id));
    } catch {
      toast.error('Failed to load folder');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  function flattenFolders(tree) {
    const result = [];
    function walk(nodes) {
      for (const n of nodes) {
        result.push(n);
        if (n.children?.length) walk(n.children);
      }
    }
    walk(tree);
    return result;
  }

  const downloadFile = (file) => {
    const a = document.createElement('a');
    a.href = `/api/files/${file.id}/download`;
    a.setAttribute('download', file.original_name);
    // Add auth header via fetch + blob
    fetch(`/api/files/${file.id}/download`, {
      credentials: 'include',
      headers: { 'Authorization': `Bearer ${window.__accessToken}` },
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = file.original_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }).catch(() => toast.error('Download failed'));
  };

  const deleteFile = async () => {
    setSaving(true);
    try {
      await api.delete(`/files/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.original_name}" deleted`);
      setDeleteTarget(null);
      loadData();
      reloadStorage?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally { setSaving(false); }
  };

  const renameFile = async () => {
    if (!renameValue.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/files/${renameTarget.id}`, { name: renameValue.trim() });
      toast.success('File renamed');
      setRenameTarget(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rename failed');
    } finally { setSaving(false); }
  };

  const moveFile = async () => {
    if (!moveFolderId) return;
    setSaving(true);
    try {
      await api.patch(`/files/${moveTarget.id}`, { folderId: moveFolderId });
      toast.success('File moved');
      setMoveTarget(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Move failed');
    } finally { setSaving(false); }
  };

  const createSubfolder = async () => {
    if (!newFolderName.trim()) return;
    setSaving(true);
    try {
      await api.post('/folders', { name: newFolderName.trim(), parentId: id });
      toast.success(`Subfolder "${newFolderName}" created`);
      setShowNewFolder(false);
      setNewFolderName('');
      loadData();
      reloadFolders?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create subfolder');
    } finally { setSaving(false); }
  };

  const deleteSubfolder = async (sf) => {
    try {
      await api.delete(`/folders/${sf.id}`);
      toast.success(`Folder "${sf.name}" deleted`);
      loadData();
      reloadFolders?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  if (loading) return (
    <div className="page-content empty-state">
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  );

  if (!folder) return (
    <div className="page-content empty-state">
      <FolderOpen size={56} className="empty-state-icon" />
      <h3>Folder not found</h3>
    </div>
  );

  const movableFolders = allFolders.filter(f => f.id !== id);
  const totalBytes = files.reduce((acc, f) => acc + (f.size_bytes || 0), 0);

  // Calculate full breadcrumb hierarchy path
  const folderPath = [];
  if (folder) {
    let curr = folder;
    while (curr) {
      folderPath.unshift(curr);
      curr = curr.parent_id ? allFolders.find(f => f.id === curr.parent_id) : null;
    }
  }

  return (
    <div className="page-content">
      {/* ── Breadcrumb Bar ── */}
      <div className="glass-breadcrumbs mb-5">
        <button className="glass-crumb" onClick={() => navigate('/')}>
          <Home size={14} />
          <span>Dashboard</span>
        </button>
        {folderPath.map((item, idx) => {
          const isLast = idx === folderPath.length - 1;
          return (
            <React.Fragment key={item.id}>
              <ChevronRight size={13} className="crumb-sep" />
              {isLast ? (
                <span className="glass-crumb current">
                  <FolderOpen size={14} color="#FF9FFC" />
                  <span>{item.name}</span>
                </span>
              ) : (
                <button className="glass-crumb" onClick={() => navigate(`/folder/${item.id}`)}>
                  <FolderOpen size={14} />
                  <span>{item.name}</span>
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Folder Hero Header ── */}
      <div className="folder-hero-header mb-6">
        <div className="folder-hero-info">
          <div className="folder-hero-badge">
            <FolderOpen size={28} color="#FF9FFC" />
          </div>
          <div>
            <h1 className="folder-hero-title">{folder.name}</h1>
            <div className="folder-hero-meta">
              <span className="folder-meta-pill">
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </span>
              {files.length > 0 && (
                <span className="folder-meta-pill">
                  {formatBytes(totalBytes)}
                </span>
              )}
              {subfolders.length > 0 && (
                <span className="folder-meta-pill">
                  {subfolders.length} {subfolders.length === 1 ? 'subfolder' : 'subfolders'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="folder-hero-actions">
          {files.length > 0 && (
            <div className="view-toggle-glass">
              <button
                className={`view-btn ${view === 'grid' ? 'active' : ''}`}
                onClick={() => setView('grid')}
                title="Grid View"
              >
                <Grid size={15} />
              </button>
              <button
                className={`view-btn ${view === 'list' ? 'active' : ''}`}
                onClick={() => setView('list')}
                title="List View"
              >
                <List size={15} />
              </button>
            </div>
          )}

          <button className="btn btn-ghost btn-glass" onClick={() => setShowNewFolder(true)}>
            <FolderPlus size={15} /> Subfolder
          </button>

          <button
            className="btn btn-primary btn-upload-glow"
            onClick={() => {
              if (files.length === 0) {
                document.getElementById('flux-file-input')?.click();
              } else {
                setShowUpload(u => !u);
              }
            }}
          >
            <Upload size={15} /> {files.length > 0 && showUpload ? 'Close' : 'Upload'}
          </button>
        </div>
      </div>

      {/* ── Upload Area (Toggled when files exist) ── */}
      {showUpload && files.length > 0 && (
        <div className="upload-container mb-6">
          <DropZone folderId={id} onUploaded={() => { loadData(); reloadStorage?.(); }} />
        </div>
      )}

      {/* ── Subfolders Section ── */}
      {subfolders.length > 0 && (
        <div className="folder-section mb-6">
          <div className="section-title mb-3">
            <span>Subfolders</span>
            <span className="section-badge">{subfolders.length}</span>
          </div>
          <div className="folder-grid">
            {subfolders.map(sf => (
              <div key={sf.id} className="folder-card" onClick={() => navigate(`/folder/${sf.id}`)}>
                <div className="folder-card-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className="btn-icon"
                    style={{ color: 'var(--danger)' }}
                    title="Delete Subfolder"
                    onClick={() => deleteSubfolder(sf)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="folder-card-icon-badge">📁</div>
                <div className="folder-card-name">{sf.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Files / Empty State (Only Rectangle DropZone) ── */}
      {files.length === 0 ? (
        <div className="folder-dropzone-wrapper">
          <DropZone folderId={id} onUploaded={() => { loadData(); reloadStorage?.(); }} />
        </div>
      ) : (
        <div className="folder-section">
          <div className="section-title mb-3">
            <span>Files</span>
            <span className="section-badge">{files.length}</span>
          </div>

          {view === 'grid' ? (
            <div className="file-grid">
              {files.map(f => (
                <div key={f.id} className="file-grid-card">
                  <div className="file-card-actions" onClick={e => e.stopPropagation()}>
                    {isPreviewable(f.mime_type) && (
                      <button className="btn-icon" title="Preview" onClick={() => setPreview(f)}>
                        <Eye size={13} />
                      </button>
                    )}
                    <button className="btn-icon" title="Download" onClick={() => downloadFile(f)}>
                      <Download size={13} />
                    </button>
                    <button className="btn-icon" title="Rename" onClick={() => { setRenameTarget(f); setRenameValue(f.original_name); }}>
                      <Pencil size={13} />
                    </button>
                    <button className="btn-icon" title="Move" onClick={() => { setMoveTarget(f); setMoveFolderId(f.folder_id); }}>
                      <Move size={13} />
                    </button>
                    <button className="btn-icon" style={{ color: 'var(--danger)' }} title="Delete" onClick={() => setDeleteTarget(f)}>
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="file-icon-wrapper">
                    {getFileIcon(f.mime_type, 36)}
                  </div>
                  <div className="file-grid-name" title={f.original_name}>{f.original_name}</div>
                  <div className="file-grid-meta">
                    <span>{formatBytes(f.size_bytes)}</span>
                    <span>•</span>
                    <span>{formatDate(f.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-table-container">
              <div className="file-row file-row-header">
                <div />
                <div>Name</div>
                <div>Size</div>
                <div>Uploaded</div>
                <div style={{ textAlign: 'right' }}>Actions</div>
              </div>
              <div className="file-list">
                {files.map(f => (
                  <div key={f.id} className="file-row">
                    <div>{getFileIcon(f.mime_type, 18)}</div>
                    <div className="truncate" style={{ fontWeight: 500, color: '#fff' }}>{f.original_name}</div>
                    <div className="text-secondary text-sm">{formatBytes(f.size_bytes)}</div>
                    <div className="text-secondary text-sm">{formatDate(f.created_at)}</div>
                    <div className="file-row-actions">
                      {isPreviewable(f.mime_type) && (
                        <button className="btn-icon" title="Preview" onClick={() => setPreview(f)}><Eye size={14} /></button>
                      )}
                      <button className="btn-icon" title="Download" onClick={() => downloadFile(f)}><Download size={14} /></button>
                      <button className="btn-icon" title="Rename" onClick={() => { setRenameTarget(f); setRenameValue(f.original_name); }}><Pencil size={14} /></button>
                      <button className="btn-icon" title="Move" onClick={() => { setMoveTarget(f); setMoveFolderId(f.folder_id); }}><Move size={14} /></button>
                      <button className="btn-icon" style={{ color: 'var(--danger)' }} title="Delete" onClick={() => setDeleteTarget(f)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {showNewFolder && (
        <Modal title="New Subfolder" onClose={() => setShowNewFolder(false)}>
          <div className="form-group">
            <label className="form-label">Folder Name</label>
            <input className="input" placeholder="Subfolder name" autoFocus
              value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createSubfolder()} />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setShowNewFolder(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={createSubfolder} disabled={saving || !newFolderName.trim()}>Create</button>
          </div>
        </Modal>
      )}

      {renameTarget && (
        <Modal title="Rename File" onClose={() => setRenameTarget(null)}>
          <div className="form-group">
            <label className="form-label">New Name</label>
            <input className="input" autoFocus value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && renameFile()} />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setRenameTarget(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={renameFile} disabled={saving || !renameValue.trim()}>Rename</button>
          </div>
        </Modal>
      )}

      {moveTarget && (
        <Modal title="Move File" onClose={() => setMoveTarget(null)}>
          <p className="text-secondary text-sm mb-4">
            Move <strong style={{ color:'var(--text-primary)' }}>"{moveTarget.original_name}"</strong> to:
          </p>
          <div className="form-group">
            <label className="form-label">Destination Folder</label>
            <select className="input" value={moveFolderId} onChange={e => setMoveFolderId(e.target.value)}
              style={{ cursor:'pointer' }}>
              {movableFolders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setMoveTarget(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={moveFile} disabled={saving}>Move</button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete File" onClose={() => setDeleteTarget(null)}>
          <p style={{ color:'var(--text-secondary)', marginBottom:4 }}>
            Delete <strong style={{ color:'var(--text-primary)' }}>"{deleteTarget.original_name}"</strong>?
          </p>
          <p style={{ fontSize:'0.875rem', color:'var(--danger)' }}>This cannot be undone.</p>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={deleteFile} disabled={saving}>Delete</button>
          </div>
        </Modal>
      )}

      {preview && <FilePreviewModal file={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

import React, { useState, useRef, useCallback } from 'react';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabase.js';
import api from '../api/client.js';
import { formatBytes } from '../utils/fileUtils.jsx';

const BUCKET_NAME = 'flux-files';

export default function DropZone({ folderId, onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState([]);
  const inputRef = useRef();

  const updateUpload = (id, patch) =>
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));

  const uploadFiles = useCallback(async (files) => {
    const items = Array.from(files).map(f => ({
      id: Math.random().toString(36).slice(2),
      name: f.name,
      size: f.size,
      file: f,
      progress: 0,
      status: 'pending',
      error: null,
    }));
    setUploads(prev => [...prev, ...items]);

    for (const item of items) {
      try {
        updateUpload(item.id, { status: 'uploading', progress: 10 });

        const fileId = uuidv4();
        const safeName = item.name.replace(/[^a-zA-Z0-9.\-_() ]/g, '_');
        const ext = safeName.lastIndexOf('.') !== -1 ? safeName.slice(safeName.lastIndexOf('.')) : '';
        const base = safeName.slice(0, safeName.lastIndexOf('.') || safeName.length).slice(0, 80);
        const storedName = `${fileId}_${base}${ext}`;
        const storagePath = `uploads/${fileId}/${storedName}`;

        // ── Step 1: Upload DIRECTLY from browser → Supabase Storage (no Render proxy) ──
        let useCloudStorage = false;
        let uploadedPath = null;

        const { error: storageErr } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, item.file, {
            contentType: item.file.type || 'application/octet-stream',
            upsert: true,
          });

        if (!storageErr) {
          useCloudStorage = true;
          uploadedPath = storagePath;
        }

        updateUpload(item.id, { progress: 75 });

        // ── Step 2: Register metadata in DB via backend (tiny JSON payload only) ──
        await api.post('/files/register', {
          fileId,
          folderId,
          originalName: safeName,
          storedName,
          storagePath: useCloudStorage ? uploadedPath : null,
          mimeType: item.file.type || 'application/octet-stream',
          sizeBytes: item.file.size,
        });

        updateUpload(item.id, { status: 'done', progress: 100 });
      } catch (err) {
        console.error('Upload error:', err);
        const msg = err.response?.data?.error || err.message || 'Upload failed';
        updateUpload(item.id, { status: 'error', error: msg });
      }
    }

    // Notify parent after all uploads
    setTimeout(() => {
      setUploads([]);
      onUploaded?.();
    }, 2000);
  }, [folderId, onUploaded]);

  const onDrop = e => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        className={`drop-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} id="flux-file-input" type="file" multiple hidden
          onChange={e => { if (e.target.files.length) uploadFiles(e.target.files); e.target.value = ''; }} />
        <div className="upload-cloud-badge">
          <Upload size={30} color="#ffffff" />
        </div>
        <div className="drop-zone-text">
          <h4 style={{ color: '#fff', fontSize: '1.05rem', marginBottom: 4 }}>Drag & drop files here to upload</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12 }}>
            or <span style={{ color: 'var(--accent-light)', textDecoration: 'underline', cursor: 'pointer' }}>browse from your device</span>
          </p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supports all file formats — no size limit</span>
        </div>
      </div>

      {uploads.length > 0 && (
        <div className="upload-list">
          {uploads.map(u => (
            <div key={u.id} className="upload-item">
              <div className="upload-item-header">
                <span className="upload-item-name">{u.name}</span>
                <span className="upload-item-size">{formatBytes(u.size)}</span>
                {u.status === 'done'  && <CheckCircle size={16} color="var(--success)" />}
                {u.status === 'error' && <AlertCircle size={16} color="var(--danger)" />}
              </div>
              {(u.status === 'uploading' || u.status === 'pending') && (
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${u.progress}%` }} />
                </div>
              )}
              {u.error && <div style={{ fontSize:'0.75rem', color:'var(--danger)' }}>{u.error}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

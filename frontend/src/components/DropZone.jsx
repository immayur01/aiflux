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
        updateUpload(item.id, { status: 'uploading', progress: 5 });

        // Step 1: Request pre-signed upload URL from backend
        const { data: ticket } = await api.post('/files/signed-upload-url', {
          folderId,
          originalName: item.name,
          sizeBytes: item.size,
        });

        const { fileId, safeName, storedName, storagePath, signedUrl, token } = ticket;

        // Step 2: Upload file directly to Supabase with real-time percentage progress
        let useCloudStorage = false;

        if (signedUrl) {
          // Use standard XMLHttpRequest to upload directly to Supabase signed URL with accurate progress tracking
          await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', signedUrl, true);
            xhr.setRequestHeader('Content-Type', item.file.type || 'application/octet-stream');

            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable) {
                const percent = Math.min(95, Math.round((evt.loaded / evt.total) * 90) + 5);
                updateUpload(item.id, { progress: percent });
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                useCloudStorage = true;
                resolve();
              } else {
                reject(new Error(`Storage rejected upload: HTTP ${xhr.status} ${xhr.responseText || xhr.statusText}`));
              }
            };

            xhr.onerror = () => reject(new Error('Network error during file upload to Supabase storage'));
            xhr.ontimeout = () => reject(new Error('Upload timed out'));
            xhr.send(item.file);
          });
        } else {
          // Fallback via uploadToSignedUrl
          const { error: uploadErr } = await supabase.storage
            .from(BUCKET_NAME)
            .uploadToSignedUrl(storagePath, token, item.file, {
              contentType: item.file.type || 'application/octet-stream',
              upsert: true,
            });
          if (uploadErr) throw uploadErr;
          useCloudStorage = true;
        }

        updateUpload(item.id, { progress: 96 });

        // Step 3: Register file metadata in database
        await api.post('/files/register', {
          fileId,
          folderId,
          originalName: safeName,
          storedName,
          storagePath: useCloudStorage ? storagePath : null,
          mimeType: item.file.type || 'application/octet-stream',
          sizeBytes: item.file.size,
        });

        updateUpload(item.id, { status: 'done', progress: 100 });
      } catch (err) {
        console.error('Upload error:', err);
        const msg = err.response?.data?.error || err.message || 'Upload failed';
        updateUpload(item.id, { status: 'error', error: msg, progress: 0 });
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="upload-item-size">{formatBytes(u.size)}</span>
                  {u.status === 'uploading' && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-light)', fontWeight: 600 }}>
                      {u.progress}%
                    </span>
                  )}
                  {u.status === 'done'  && <CheckCircle size={16} color="var(--success)" />}
                  {u.status === 'error' && <AlertCircle size={16} color="var(--danger)" />}
                </div>
              </div>
              {(u.status === 'uploading' || u.status === 'pending') && (
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${u.progress}%` }} />
                </div>
              )}
              {u.error && <div style={{ fontSize:'0.75rem', color:'var(--danger)', marginTop: 2 }}>{u.error}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

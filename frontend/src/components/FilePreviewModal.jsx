import React from 'react';
import { X } from 'lucide-react';

export default function FilePreviewModal({ file, onClose }) {
  const { id, original_name, mime_type } = file;
  const previewUrl = `/api/files/${id}/preview`;

  let content;
  if (mime_type.startsWith('image/')) {
    content = <img src={previewUrl} alt={original_name} style={{ maxWidth:'85vw', maxHeight:'82vh', objectFit:'contain' }} />;
  } else if (mime_type === 'application/pdf') {
    content = <iframe src={previewUrl} title={original_name} style={{ width:'80vw', height:'82vh', border:'none' }} />;
  } else if (mime_type.startsWith('text/')) {
    content = <TextPreview url={previewUrl} />;
  } else {
    content = <div style={{ padding:40, color:'var(--text-secondary)' }}>Preview not available</div>;
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:'var(--bg-surface)', border:'1px solid var(--border-bright)',
        borderRadius:'var(--radius-xl)', overflow:'hidden',
        maxWidth:'90vw', maxHeight:'90vh', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between',
          borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)' }}>
          <span style={{ fontSize:'0.9rem', fontWeight:600, maxWidth:'60vw', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {original_name}
          </span>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ overflow:'auto', display:'flex', alignItems:'center', justifyContent:'center',
          background:'#000', flex:1 }}>
          {content}
        </div>
      </div>
    </div>
  );
}

function TextPreview({ url }) {
  const [text, setText] = React.useState('Loading…');
  React.useEffect(() => {
    fetch(url, { credentials: 'include', headers: { 'Authorization': `Bearer ${window.__accessToken}` } })
      .then(r => r.text()).then(setText).catch(() => setText('Failed to load file.'));
  }, [url]);
  return (
    <pre style={{ padding:24, color:'var(--text-primary)', fontSize:'0.8125rem',
      whiteSpace:'pre-wrap', wordBreak:'break-word', maxHeight:'82vh', overflow:'auto',
      maxWidth:'80vw', minWidth:400 }}>
      {text}
    </pre>
  );
}

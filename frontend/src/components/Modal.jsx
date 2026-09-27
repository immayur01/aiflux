import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'preview-modal' : ''}`} style={wide ? { maxWidth:'90vw', width:'auto' } : {}}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

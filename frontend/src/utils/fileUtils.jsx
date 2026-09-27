import React from 'react';
import {
  Image, Film, Music, FileText, File, Archive,
  Code, FileJson, FileType, AppWindow
} from 'lucide-react';

export function getFileIcon(mimeType, size = 20) {
  if (!mimeType) return <File size={size} className="file-icon-default" />;
  if (mimeType.startsWith('image/'))  return <Image  size={size} className="file-icon-image" />;
  if (mimeType.startsWith('video/'))  return <Film   size={size} className="file-icon-video" />;
  if (mimeType.startsWith('audio/'))  return <Music  size={size} className="file-icon-audio" />;
  if (mimeType === 'application/pdf') return <FileText size={size} className="file-icon-pdf" />;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip') || mimeType.includes('7z') || mimeType.includes('rar'))
    return <Archive size={size} className="file-icon-zip" />;
  if (mimeType.includes('msdos') || mimeType.includes('executable') || mimeType.includes('appimage') || mimeType.includes('installer'))
    return <AppWindow size={size} className="file-icon-exe" />;
  if (mimeType === 'application/json') return <FileJson size={size} className="file-icon-code" />;
  if (mimeType.startsWith('text/'))   return <FileText size={size} className="file-icon-text" />;
  if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('xml'))
    return <Code size={size} className="file-icon-code" />;
  return <File size={size} className="file-icon-default" />;
}

export function formatBytes(bytes) {
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024**3)        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isPreviewable(mimeType) {
  return mimeType?.startsWith('image/') || mimeType?.startsWith('text/') || mimeType === 'application/pdf';
}

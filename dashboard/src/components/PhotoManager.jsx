import React, { useRef, useState } from 'react';
import { api, resizeImage } from '../api.js';
import { useToast } from '../App.jsx';

export default function PhotoManager({ place, onChange }) {
  const toast = useToast();
  const fileInput = useRef(null);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [dropzoneHot, setDropzoneHot] = useState(false);
  const [uploading, setUploading] = useState(false);

  const photos = place.place_photos;
  const visible = photos.filter((p) => !p.is_hidden);
  const cover = visible.find((p) => p.is_cover) ?? visible[0];

  const act = async (fn, doneMsg) => {
    try {
      await fn();
      await onChange();
      if (doneMsg) toast(doneMsg);
    } catch (err) {
      toast(`Photo error: ${err.message}`);
    }
  };

  const upload = async (files) => {
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setUploading(true);
    try {
      for (const file of images) {
        const blob = await resizeImage(file);
        await api.uploadPhoto(place.slug, blob, file.name.replace(/\.\w+$/, ''));
      }
      await onChange();
      toast(images.length > 1 ? `${images.length} photos uploaded` : 'Photo uploaded');
    } catch (err) {
      toast(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const reorder = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    const ids = photos.map((p) => p.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    ids.splice(to, 0, ...ids.splice(from, 1));
    act(() => api.reorderPhotos(place.slug, ids));
  };

  return (
    <div className="lighttable">
      <div className="coverwrap">
        {cover
          ? <>
              <img src={cover.photo_uri} alt={`Cover photo of ${place.name_en}`} />
              {cover.attribution_name && <span className="attr">📷 {cover.attribution_name}</span>}
            </>
          : <div className="nocover">No visible photos — upload one below</div>}
      </div>

      <div className="photogrid">
        {photos.map((p) => (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            className={`pcell ${p.is_cover ? 'cover' : ''} ${p.is_hidden ? 'hidden-photo' : ''} ${overId === p.id ? 'dragover' : ''}`}
            title={p.is_cover ? 'Current cover' : 'Click to set as cover'}
            onClick={() => !p.is_cover && act(() => api.patchPhoto(p.id, { is_cover: true }), 'Cover updated')}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                e.preventDefault();
                if (!p.is_cover) act(() => api.patchPhoto(p.id, { is_cover: true }), 'Cover updated');
              }
            }}
            draggable
            onDragStart={() => setDragId(p.id)}
            onDragOver={(e) => { e.preventDefault(); setOverId(p.id); }}
            onDragLeave={() => setOverId(null)}
            onDrop={(e) => { e.preventDefault(); setOverId(null); reorder(dragId, p.id); }}
          >
            <img src={p.photo_uri} alt="" loading="lazy" />
            {p.source === 'upload' && <span className="badge">YOURS</span>}
            {p.is_cover && <span className="badge" style={{ left: 'auto', right: 6 }}>COVER</span>}
            <span className="ops">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); act(() => api.patchPhoto(p.id, { is_hidden: !p.is_hidden })); }}
              >
                {p.is_hidden ? 'Show' : 'Hide'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this photo permanently?')) act(() => api.deletePhoto(p.id), 'Photo deleted');
                }}
              >
                Del
              </button>
            </span>
          </div>
        ))}

        <button
          type="button"
          className={`dropzone ${dropzoneHot ? 'dragover' : ''}`}
          onClick={() => fileInput.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDropzoneHot(true); }}
          onDragLeave={() => setDropzoneHot(false)}
          onDrop={(e) => { e.preventDefault(); setDropzoneHot(false); upload(e.dataTransfer.files); }}
          aria-label="Upload photos"
        >
          <span className="plus">+</span>
          {uploading ? 'Uploading…' : 'Add photo'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { upload(e.target.files); e.target.value = ''; }}
        />
      </div>
    </div>
  );
}

// Controlled photo light-table. Nothing here touches the API: every action
// (cover, hide, delete, reorder, upload) is staged into `edits` owned by
// PlaceEditor, and applied in one batch when the reviewer presses Save —
// the same contract as the text fields.

import React, { useRef, useState } from 'react';
import { resizeImage } from '../api.js';
import { useToast } from '../App.jsx';

export function emptyPhotoEdits() {
  return { coverId: null, hidden: {}, deleted: [], uploads: [], order: null };
}

export function photoEditsDirty(edits) {
  return edits.coverId !== null
    || Object.keys(edits.hidden).length > 0
    || edits.deleted.length > 0
    || edits.uploads.length > 0
    || edits.order !== null;
}

// Merge saved photos + staged edits into the list the grid displays.
export function stagedPhotoList(place, edits) {
  const deleted = new Set(edits.deleted);
  const saved = [...place.place_photos]
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((p) => !deleted.has(p.id))
    .map((p) => ({ ...p, is_hidden: edits.hidden[p.id] ?? p.is_hidden }));
  const uploads = edits.uploads.map((u) => ({
    id: u.tempId, photo_uri: u.previewUrl, source: 'upload', is_hidden: false,
    is_cover: false, attribution_name: null, isTemp: true,
  }));
  let list = [...saved, ...uploads];
  if (edits.order) {
    const pos = new Map(edits.order.map((id, i) => [id, i]));
    list = [...list].sort((a, b) => (pos.get(a.id) ?? 999) - (pos.get(b.id) ?? 999));
  }
  const visible = list.filter((p) => !p.is_hidden);
  const cover = (edits.coverId && list.find((p) => p.id === edits.coverId))
    || visible.find((p) => p.is_cover)
    || visible[0]
    || null;
  return { list, cover };
}

export default function PhotoManager({ place, edits, setEdits }) {
  const toast = useToast();
  const fileInput = useRef(null);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [dropzoneHot, setDropzoneHot] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const { list, cover } = stagedPhotoList(place, edits);

  const setCover = (p) => {
    if (cover?.id === p.id || p.is_hidden) return;
    setEdits((e) => ({ ...e, coverId: p.id }));
  };

  const toggleHidden = (p) => setEdits((e) => ({
    ...e,
    hidden: { ...e.hidden, [p.id]: !(e.hidden[p.id] ?? p.is_hidden) },
    coverId: e.coverId === p.id ? null : e.coverId,
  }));

  const remove = (p) => setEdits((e) => {
    if (p.isTemp) {
      const upload = e.uploads.find((u) => u.tempId === p.id);
      if (upload) URL.revokeObjectURL(upload.previewUrl);
    }
    return {
      ...e,
      deleted: p.isTemp ? e.deleted : [...e.deleted, p.id],
      uploads: p.isTemp ? e.uploads.filter((u) => u.tempId !== p.id) : e.uploads,
      coverId: e.coverId === p.id ? null : e.coverId,
      order: e.order ? e.order.filter((id) => id !== p.id) : null,
    };
  });

  const reorder = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    const ids = list.map((p) => p.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    ids.splice(to, 0, ...ids.splice(from, 1));
    setEdits((e) => ({ ...e, order: ids }));
  };

  const stageUploads = async (files) => {
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setPreparing(true);
    try {
      const prepared = await Promise.all(images.map(async (file) => {
        const blob = await resizeImage(file);
        return {
          tempId: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          blob,
          name: file.name.replace(/\.\w+$/, ''),
          previewUrl: URL.createObjectURL(blob),
        };
      }));
      setEdits((e) => ({ ...e, uploads: [...e.uploads, ...prepared] }));
    } catch (err) {
      toast(`Could not read image: ${err.message}`);
    } finally {
      setPreparing(false);
    }
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
        {list.map((p) => (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            className={`pcell ${cover?.id === p.id ? 'cover' : ''} ${p.is_hidden ? 'hidden-photo' : ''} ${overId === p.id ? 'dragover' : ''}`}
            title={cover?.id === p.id ? 'Current cover' : 'Click to set as cover'}
            onClick={() => setCover(p)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                e.preventDefault();
                setCover(p);
              }
            }}
            draggable
            onDragStart={() => setDragId(p.id)}
            onDragOver={(e) => { e.preventDefault(); setOverId(p.id); }}
            onDragLeave={() => setOverId(null)}
            onDrop={(e) => { e.preventDefault(); setOverId(null); reorder(dragId, p.id); }}
          >
            <img src={p.photo_uri} alt="" loading="lazy" />
            {p.isTemp && <span className="badge">NEW</span>}
            {!p.isTemp && p.source === 'upload' && <span className="badge">YOURS</span>}
            {cover?.id === p.id && <span className="badge" style={{ left: 'auto', right: 6 }}>COVER</span>}
            <span className="ops">
              {!p.isTemp && (
                <button type="button" onClick={(e) => { e.stopPropagation(); toggleHidden(p); }}>
                  {p.is_hidden ? 'Show' : 'Hide'}
                </button>
              )}
              <button type="button" onClick={(e) => { e.stopPropagation(); remove(p); }}>
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
          onDrop={(e) => { e.preventDefault(); setDropzoneHot(false); stageUploads(e.dataTransfer.files); }}
          aria-label="Upload photos"
        >
          <span className="plus">+</span>
          {preparing ? 'Reading…' : 'Add photo'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { stageUploads(e.target.files); e.target.value = ''; }}
        />
      </div>
    </div>
  );
}

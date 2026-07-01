import React, { useEffect, useRef, useState, useCallback } from 'react';
import { computeCropRect, defaultFrame, FRAME_ASPECT } from '../lib/framing.js';
import { renderFramedDataUrl } from '../lib/canvas.js';

// Preview frame size (px). Portrait 3:4. The preview is a WYSIWYG window onto
// the same crop math the bake uses.
const FW = 264;
const FH = Math.round(FW / FRAME_ASPECT); // 352

// Resolve a canvas-safe editable source. Only inline data URLs are already
// canvas-clean. Everything else — external retailer CDNs AND our own Firebase
// Storage download URLs — must be rehosted server-side (imageProxy) to a data
// URL. Storage URLs display fine in a plain <img> but send no CORS headers, so
// a crossOrigin canvas load taints and the bake fails; proxying to a data URL
// sidesteps CORS entirely (the same path that made polish reliable).
async function resolveEditableSrc(src) {
  if (!src) return null;
  if (src.startsWith('data:')) return src;
  try {
    const { imageUrlToCompressedDataUrl } = await import('../lib/net.js');
    const rehosted = await imageUrlToCompressedDataUrl(src);
    return rehosted && rehosted.startsWith('data:') ? rehosted : src;
  } catch {
    return src;
  }
}

// ImageFramer — fullscreen crop/zoom/pan editor.
//   baseSrc      the image to frame (cutoutUrl ?? images[0])
//   initialFrame stored { zoom, offsetX, offsetY } to restore, or defaultFrame()
//   onCommit({ dataUrl, frame })  called on Save with the baked crop
//   onClose()                     called on Cancel / backdrop
export default function ImageFramer({ baseSrc, initialFrame, onCommit, onClose }) {
  const [status, setStatus] = useState('loading'); // loading | ready | error | saving
  const [frame, setFrame] = useState(() => initialFrame || defaultFrame());
  const imgRef = useRef(null);          // the loaded HTMLImageElement (natural dims)
  const [editableSrc, setEditableSrc] = useState(null);
  const drag = useRef(null);            // { x, y } pointer origin during a pan

  // Resolve + load the base image once.
  useEffect(() => {
    let alive = true;
    (async () => {
      const safe = await resolveEditableSrc(baseSrc);
      if (!alive) return;
      if (!safe) { setStatus('error'); return; }
      const im = new Image();
      im.onload = () => { if (alive) { imgRef.current = im; setEditableSrc(safe); setStatus('ready'); } };
      im.onerror = () => { if (alive) setStatus('error'); };
      im.src = safe;
    })();
    return () => { alive = false; };
  }, [baseSrc]);

  // Derived display geometry for the <img> inside the frame. s0 maps the zoom-1
  // base crop to the frame; scale = s0 * zoom; left/top place the SAME sx/sy
  // that computeCropRect will crop, guaranteeing preview === output.
  const geom = (() => {
    const im = imgRef.current;
    if (!im) return null;
    const nw = im.naturalWidth, nh = im.naturalHeight;
    const imgAspect = nw / nh;
    const baseCropW = imgAspect > FRAME_ASPECT ? nh * FRAME_ASPECT : nw;
    const s0 = FW / baseCropW;
    const scale = s0 * frame.zoom;
    const { sx, sy } = computeCropRect({ naturalW: nw, naturalH: nh, ...frame });
    return { dispW: nw * scale, dispH: nh * scale, left: -sx * scale, top: -sy * scale };
  })();

  const onPointerDown = (e) => {
    if (status !== 'ready') return;
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current || !geom) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    // Analytic inverse of the preview mapping: moving the image by dx px changes
    // offsetX by -2·dx / (dispW - FW). Guard the degenerate no-overflow case.
    const spanX = geom.dispW - FW;
    const spanY = geom.dispH - FH;
    setFrame((f) => ({
      ...f,
      offsetX: spanX > 0 ? Math.max(-1, Math.min(1, f.offsetX - (2 * dx) / spanX)) : 0,
      offsetY: spanY > 0 ? Math.max(-1, Math.min(1, f.offsetY - (2 * dy) / spanY)) : 0,
    }));
  };
  const onPointerUp = () => { drag.current = null; };

  const onZoom = (e) => setFrame((f) => ({ ...f, zoom: Number(e.target.value) / 100 }));
  const onReset = () => setFrame(defaultFrame());

  const onSave = useCallback(async () => {
    if (status !== 'ready') return;
    setStatus('saving');
    try {
      const { url, ok } = await renderFramedDataUrl(editableSrc, frame);
      if (!ok) { setStatus('error'); return; }
      await onCommit({ dataUrl: url, frame });
    } catch {
      setStatus('error');
    }
  }, [status, editableSrc, frame, onCommit]);

  return (
    <div className="fixed inset-0 z-[120] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[340px] max-w-full rounded-2xl bg-white overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <button type="button" onClick={onClose}
            className="text-sm text-stone-500 hover:text-stone-800">Cancel</button>
          <span className="text-sm font-medium text-stone-800">Edit image</span>
          <button type="button" onClick={onSave} disabled={status !== 'ready'}
            className="text-sm font-medium text-emerald-700 disabled:opacity-40">
            {status === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="bg-stone-800 p-5 flex items-center justify-center">
          <div className="relative overflow-hidden rounded-sm bg-stone-700 touch-none select-none"
               style={{ width: FW, height: FH }}
               onPointerDown={onPointerDown} onPointerMove={onPointerMove}
               onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            {status === 'ready' && geom && editableSrc && (
              <img src={editableSrc} alt="" draggable={false}
                style={{ position: 'absolute', left: geom.left, top: geom.top, width: geom.dispW, height: geom.dispH, maxWidth: 'none' }} />
            )}
            {status === 'ready' && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute top-0 bottom-0" style={{ left: '33.33%', width: 1, background: 'rgba(255,255,255,0.35)' }} />
                <div className="absolute top-0 bottom-0" style={{ left: '66.66%', width: 1, background: 'rgba(255,255,255,0.35)' }} />
                <div className="absolute left-0 right-0" style={{ top: '33.33%', height: 1, background: 'rgba(255,255,255,0.35)' }} />
                <div className="absolute left-0 right-0" style={{ top: '66.66%', height: 1, background: 'rgba(255,255,255,0.35)' }} />
              </div>
            )}
            {status === 'loading' && <div className="absolute inset-0 grid place-items-center text-xs text-stone-300">Loading…</div>}
            {status === 'error' && <div className="absolute inset-0 grid place-items-center text-xs text-red-200 px-4 text-center">Couldn't load this image for editing.</div>}
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400">Zoom</span>
            <input type="range" min="100" max="300" step="1"
              value={Math.round(frame.zoom * 100)} onChange={onZoom}
              disabled={status !== 'ready'} className="flex-1" />
            <span className="text-xs font-medium text-stone-700 w-10 text-right">{frame.zoom.toFixed(2)}×</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-stone-400">Frame 3:4 · matches your grid</span>
            <button type="button" onClick={onReset} disabled={status !== 'ready'}
              className="text-[11px] text-stone-500 hover:text-stone-800 disabled:opacity-40">Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}

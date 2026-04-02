import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ZoomIn, ZoomOut, RotateCcw, Check } from 'lucide-react';

interface ImageCropModalProps {
  imageFile: File;
  onCropComplete: (croppedBlob: Blob, mimeType: string) => void;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;
const CROP_SIZE = 256;

const ImageCropModal: React.FC<ImageCropModalProps> = ({
  imageFile,
  onCropComplete,
  onClose,
}) => {
  const { t } = useTranslation();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [processing, setProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
  }, []);

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  const handleReset = () => { setZoom(1); setPosition({ x: 0, y: 0 }); };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
  }, []);

  // Drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: t.clientX - position.x, y: t.clientY - position.y });
    }
  }, [position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const t = e.touches[0];
    setPosition({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => setIsDragging(false), []);

  /*
   * Crop logic:
   * The image is rendered with object-fit: cover inside a 256x256 circle.
   * "cover" means the image is scaled so its shorter side matches 256px,
   * then centered. zoom and position are applied on top of that.
   *
   * We replicate this math to find the source rect in natural pixels.
   */
  const handleCrop = useCallback(async () => {
    if (!naturalSize.w || !imageUrl) return;
    setProcessing(true);

    try {
      const { w: nw, h: nh } = naturalSize;
      const container = 256; // display px

      // "cover" base scale: scale so shorter side fills container
      const baseScale = Math.max(container / nw, container / nh);
      const effectiveScale = baseScale * zoom;

      // Scaled image size in display px
      const scaledW = nw * effectiveScale;
      const scaledH = nh * effectiveScale;

      // Image is centered, then offset by position
      const imgLeft = (container - scaledW) / 2 + position.x;
      const imgTop = (container - scaledH) / 2 + position.y;

      // Map container rect (0,0,container,container) to natural coords
      const srcX = (0 - imgLeft) / effectiveScale;
      const srcY = (0 - imgTop) / effectiveScale;
      const srcW = container / effectiveScale;
      const srcH = container / effectiveScale;

      const canvas = document.createElement('canvas');
      canvas.width = CROP_SIZE;
      canvas.height = CROP_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');

      const sourceImg = new Image();
      sourceImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        sourceImg.onload = () => resolve();
        sourceImg.onerror = () => reject(new Error('Failed to load'));
        sourceImg.src = imageUrl;
      });

      ctx.drawImage(
        sourceImg,
        Math.max(0, srcX), Math.max(0, srcY), srcW, srcH,
        0, 0, CROP_SIZE, CROP_SIZE
      );

      const mimeType = imageFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (blob) onCropComplete(blob, mimeType);
          setProcessing(false);
        },
        mimeType,
        mimeType === 'image/jpeg' ? 0.9 : undefined
      );
    } catch (error) {
      console.error('Crop error:', error);
      setProcessing(false);
    }
  }, [imageFile, imageUrl, naturalSize, zoom, position, onCropComplete]);

  // Compute inline styles for the preview image to match "cover" + zoom + pan
  const previewStyle = (): React.CSSProperties => {
    if (!naturalSize.w) return {};
    const container = 256;
    const baseScale = Math.max(container / naturalSize.w, container / naturalSize.h);
    const s = baseScale * zoom;
    const w = naturalSize.w * s;
    const h = naturalSize.h * s;
    return {
      position: 'absolute',
      left: (container - w) / 2 + position.x,
      top: (container - h) / 2 + position.y,
      width: w,
      height: h,
      maxWidth: 'none',
      maxHeight: 'none',
    };
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[var(--fc-section,#0A0A0A)] rounded-xl border border-[var(--fc-section-border,#1F1F1F)] max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--fc-section-border,#1F1F1F)]">
          <h3 className="text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)]">{t('imageCrop.title')}</h3>
          <button onClick={onClose} className="p-1 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-text,#FAFAFA)] transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Crop Area */}
        <div className="p-6">
          {!imageUrl ? (
            <div className="w-64 h-64 mx-auto flex items-center justify-center bg-[var(--fc-section-hover,#151515)] rounded-full">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
          <>
          <div
            ref={containerRef}
            className="relative w-64 h-64 mx-auto overflow-hidden rounded-full bg-[var(--fc-section-hover,#151515)] cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={imageUrl}
              alt={t('imageCrop.cropPreviewAlt')}
              onLoad={handleImageLoad}
              className="select-none"
              style={previewStyle()}
              draggable={false}
            />
            <div className="absolute inset-0 pointer-events-none border-4 border-white/30 rounded-full" />
          </div>

          <p className="text-center text-sm text-[var(--fc-section-muted,#666666)] mt-4">
            {t('imageCrop.instructions')}
          </p>

          {/* Zoom Controls */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <button onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM} className="p-2 text-[var(--fc-section-muted,#A0A0A0)] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#151515)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title={t('imageCrop.zoomOut')}>
              <ZoomOut size={20} />
            </button>
            <div className="flex items-center gap-2 min-w-[120px]">
              <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={ZOOM_STEP} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-full h-2 bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg appearance-none cursor-pointer accent-white" />
            </div>
            <button onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM} className="p-2 text-[var(--fc-section-muted,#A0A0A0)] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#151515)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title={t('imageCrop.zoomIn')}>
              <ZoomIn size={20} />
            </button>
            <button onClick={handleReset} className="p-2 text-[var(--fc-section-muted,#A0A0A0)] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#151515)] rounded-lg transition-colors" title={t('imageCrop.reset')}>
              <RotateCcw size={20} />
            </button>
          </div>
          </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--fc-section-border,#1F1F1F)]">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] hover:text-[var(--fc-section-text,#FAFAFA)] transition-colors">
            {t('imageCrop.cancelButton')}
          </button>
          <button onClick={handleCrop} disabled={processing} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-black bg-white rounded-lg hover:bg-[var(--fc-button-hover,#E0E0E0)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {processing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('imageCrop.processing')}
              </>
            ) : (
              <>
                <Check size={16} />
                {t('imageCrop.applyButton')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ZoomIn, ZoomOut, RotateCcw, Check } from 'lucide-react';

interface ImageCropModalProps {
  imageFile: File;
  onCropComplete: (croppedBlob: Blob, mimeType: string) => void;
  onClose: () => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
const CROP_SIZE = 256; // Output size in pixels

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
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [processing, setProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load image from file
  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Get image dimensions when loaded
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  // Handle zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // Handle zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
  }, []);

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  // Handle drag move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setPosition({ x: newX, y: newY });
  }, [isDragging, dragStart]);

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle touch events for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  }, [position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const newX = touch.clientX - dragStart.x;
    const newY = touch.clientY - dragStart.y;
    setPosition({ x: newX, y: newY });
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Generate cropped image
  const handleCrop = useCallback(async () => {
    if (!imageRef.current || !containerRef.current) return;

    setProcessing(true);

    try {
      const container = containerRef.current;
      const img = imageRef.current;

      // Calculate the visible area of the image
      const containerRect = container.getBoundingClientRect();
      const containerSize = Math.min(containerRect.width, containerRect.height);

      // Calculate the scale factor between display and natural image size
      const displayWidth = img.offsetWidth * zoom;
      const displayHeight = img.offsetHeight * zoom;
      const scaleX = img.naturalWidth / displayWidth;
      const scaleY = img.naturalHeight / displayHeight;

      // Calculate the center of the crop area in the display
      const cropCenterX = containerSize / 2;
      const cropCenterY = containerSize / 2;

      // Calculate the top-left of the crop area relative to the image
      const imgRect = img.getBoundingClientRect();
      const imgDisplayX = imgRect.left - containerRect.left;
      const imgDisplayY = imgRect.top - containerRect.top;

      // Source coordinates in the natural image
      const srcX = (cropCenterX - imgDisplayX - containerSize / 2) * scaleX;
      const srcY = (cropCenterY - imgDisplayY - containerSize / 2) * scaleY;
      const srcSize = containerSize * Math.min(scaleX, scaleY);

      // Create canvas for cropping
      const canvas = document.createElement('canvas');
      canvas.width = CROP_SIZE;
      canvas.height = CROP_SIZE;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Create a new image element to ensure it's fully loaded
      const sourceImg = new Image();
      sourceImg.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        sourceImg.onload = () => resolve();
        sourceImg.onerror = () => reject(new Error('Failed to load image'));
        sourceImg.src = imageUrl!;
      });

      // Draw the cropped portion
      ctx.drawImage(
        sourceImg,
        Math.max(0, srcX),
        Math.max(0, srcY),
        srcSize,
        srcSize,
        0,
        0,
        CROP_SIZE,
        CROP_SIZE
      );

      // Convert to blob
      const mimeType = imageFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = mimeType === 'image/jpeg' ? 0.9 : undefined;

      canvas.toBlob(
        (blob) => {
          if (blob) {
            onCropComplete(blob, mimeType);
          } else {
            console.error('Failed to create blob');
          }
          setProcessing(false);
        },
        mimeType,
        quality
      );
    } catch (error) {
      console.error('Error cropping image:', error);
      setProcessing(false);
    }
  }, [imageFile, imageUrl, zoom, onCropComplete]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[var(--fc-section,#0A0A0A)] rounded-xl border border-[var(--fc-section-border,#1F1F1F)] max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--fc-section-border,#1F1F1F)]">
          <h3 className="text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)]">{t('imageCrop.title')}</h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-text,#FAFAFA)] transition-colors"
          >
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
              ref={imageRef}
              src={imageUrl}
              alt={t('imageCrop.cropPreviewAlt')}
              onLoad={handleImageLoad}
              className="absolute select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                left: '50%',
                top: '50%',
                marginLeft: '-50%',
                marginTop: '-50%',
                maxWidth: 'none',
                maxHeight: 'none',
                width: '100%',
                height: 'auto',
              }}
              draggable={false}
            />
            {/* Circular overlay guide */}
            <div className="absolute inset-0 pointer-events-none border-4 border-white/30 rounded-full" />
          </div>

          <p className="text-center text-sm text-[var(--fc-section-muted,#666666)] mt-4">
            {t('imageCrop.instructions')}
          </p>

          {/* Zoom Controls */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="p-2 text-[var(--fc-section-muted,#A0A0A0)] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#151515)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('imageCrop.zoomOut')}
            >
              <ZoomOut size={20} />
            </button>

            <div className="flex items-center gap-2 min-w-[120px]">
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={ZOOM_STEP}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-2 bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <button
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="p-2 text-[var(--fc-section-muted,#A0A0A0)] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#151515)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('imageCrop.zoomIn')}
            >
              <ZoomIn size={20} />
            </button>

            <button
              onClick={handleReset}
              className="p-2 text-[var(--fc-section-muted,#A0A0A0)] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#151515)] rounded-lg transition-colors"
              title={t('imageCrop.reset')}
            >
              <RotateCcw size={20} />
            </button>
          </div>
          </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--fc-section-border,#1F1F1F)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] hover:text-[var(--fc-section-text,#FAFAFA)] transition-colors"
          >
            {t('imageCrop.cancelButton')}
          </button>
          <button
            onClick={handleCrop}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-black bg-white rounded-lg hover:bg-[var(--fc-button-hover,#E0E0E0)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
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

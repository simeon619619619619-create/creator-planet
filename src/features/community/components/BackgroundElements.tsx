import React from 'react';
import type { BackgroundElement } from '../../../core/supabase/database.types';

interface BackgroundElementsProps {
  elements: BackgroundElement[];
}

const BackgroundElements: React.FC<BackgroundElementsProps> = ({ elements }) => {
  if (!elements || elements.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {elements.map((el) => (
        <img
          key={el.id}
          src={el.image_url}
          alt=""
          className="absolute"
          style={{
            left: `${el.x}%`,
            top: `${el.y}%`,
            width: `${el.size}px`,
            height: 'auto',
            opacity: el.opacity,
            transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
          }}
          draggable={false}
        />
      ))}
    </div>
  );
};

export default BackgroundElements;

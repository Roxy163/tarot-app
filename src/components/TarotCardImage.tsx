import React, { useEffect, useState } from 'react';

interface TarotCardImageProps {
  src: string;
  alt: string;
  name: string;
  className?: string;
  loading?: 'eager' | 'lazy';
}

export const TarotCardImage: React.FC<TarotCardImageProps> = ({
  src,
  alt,
  name,
  className = '',
  loading = 'lazy',
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [src]);

  if (failedSrc === src) {
    return (
      <div
        data-testid="tarot-card-image-fallback"
        role="img"
        aria-label={`${name}牌面暂不可用`}
        className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-white via-forest-bg to-forest-accent/10 text-center ${className}`}
      >
        <div className="pointer-events-none absolute inset-1.5 rounded-[0.45rem] border border-forest-accent/25" />
        <div className="pointer-events-none absolute inset-2.5 rounded-[0.35rem] border border-dashed border-forest-accent/20" />
        <div className="relative flex flex-col items-center gap-1 px-2 text-forest-accent/75">
          <span className="text-lg leading-none">✦</span>
          <span className="font-serif text-[10px] font-bold leading-tight">{name}</span>
          <span className="text-[8px] text-forest-muted">牌面暂不可用</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
    />
  );
};

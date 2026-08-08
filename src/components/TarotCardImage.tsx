import React, { useEffect, useRef, useState } from 'react';
import { getCardImageFormatUrl } from '../constants';

interface TarotCardImageProps {
  src: string;
  alt: string;
  name: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
}

export const TarotCardImage: React.FC<TarotCardImageProps> = ({
  src,
  alt,
  name,
  className = '',
  loading = 'lazy',
  fetchPriority = 'auto',
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setFailedSrc(null);
    setIsLoaded(false);

    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      setIsLoaded(true);
    }
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

  const objectFitClass = className.match(/\bobject-(?:contain|cover|fill|none|scale-down)\b/)?.[0] || 'object-cover';
  const frameClassName = className
    .replace(/\bobject-(?:contain|cover|fill|none|scale-down)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const avifSrc = getCardImageFormatUrl(src, 'avif');
  const webpSrc = getCardImageFormatUrl(src, 'webp');

  return (
    <span className={`relative block overflow-hidden bg-forest-bg ${frameClassName}`}>
      <span
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white via-forest-bg to-forest-accent/10 text-center transition-opacity duration-200 ${
          isLoaded ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <span className="flex flex-col items-center gap-1 px-2 text-forest-accent/70">
          <span className="text-sm leading-none">✦</span>
          <span className="h-1.5 w-8 rounded-full bg-forest-accent/15" />
          <span className="h-1 w-5 rounded-full bg-forest-accent/10" />
        </span>
      </span>
      <picture>
        {avifSrc && <source srcSet={avifSrc} type="image/avif" />}
        {webpSrc && <source srcSet={webpSrc} type="image/webp" />}
        <img
          src={src}
          alt={alt}
          loading={loading}
          fetchPriority={fetchPriority}
          decoding="async"
          className={`absolute inset-0 h-full w-full ${objectFitClass} transition-opacity duration-200 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          ref={imageRef}
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoaded(true)}
          onError={() => setFailedSrc(src)}
        />
      </picture>
    </span>
  );
};

import React from 'react';

type MysticWatermarkVariant = 'sun' | 'book' | 'quill' | 'star';

interface MysticWatermarkProps {
  variant?: MysticWatermarkVariant;
  className?: string;
}

const SunMark = () => (
  <>
    <circle cx="60" cy="60" r="22" />
    <circle cx="60" cy="60" r="38" />
    <path d="M60 10v18M60 92v18M10 60h18M92 60h18M25 25l13 13M82 82l13 13M95 25 82 38M38 82 25 95" />
    <path d="m60 33 8 19 19 8-19 8-8 19-8-19-19-8 19-8 8-19Z" />
  </>
);

const BookMark = () => (
  <>
    <path d="M20 28c16-8 28-6 40 2v62c-12-8-24-10-40-2V28Z" />
    <path d="M100 28c-16-8-28-6-40 2v62c12-8 24-10 40-2V28Z" />
    <path d="M60 30v62M30 44c8-2 15-1 22 2M30 58c8-2 15-1 22 2M68 46c7-3 14-4 22-2M68 60c7-3 14-4 22-2" />
  </>
);

const QuillMark = () => (
  <>
    <path d="M88 18C53 23 31 46 26 84c25-7 48-26 62-66Z" />
    <path d="M77 30 25 91M45 57c6-1 14 1 19 5M34 72c5-1 11 0 16 4" />
    <path d="M22 98h52" />
  </>
);

const StarMark = () => (
  <>
    <circle cx="60" cy="60" r="42" />
    <path d="M60 18v84M18 60h84M30 30l60 60M90 30 30 90" />
    <path d="m60 24 12 24 26 12-26 12-12 24-12-24-26-12 26-12 12-24Z" />
  </>
);

const renderMark = (variant: MysticWatermarkVariant) => {
  if (variant === 'book') return <BookMark />;
  if (variant === 'quill') return <QuillMark />;
  if (variant === 'star') return <StarMark />;
  return <SunMark />;
};

export const MysticWatermark: React.FC<MysticWatermarkProps> = ({
  variant = 'star',
  className = '',
}) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 120 120"
    className={`pointer-events-none absolute fill-none stroke-current stroke-[1.25] ${className}`}
  >
    <g strokeLinecap="round" strokeLinejoin="round">
      {renderMark(variant)}
    </g>
  </svg>
);

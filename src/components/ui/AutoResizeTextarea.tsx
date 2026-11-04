import React, { useCallback, useEffect, useRef } from 'react';

type AutoResizeTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minRows?: number;
  maxRows?: number;
};

export const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
  minRows = 2,
  maxRows = 10,
  value,
  onInput,
  style,
  ...props
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const computed = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 20;
    const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computed.paddingBottom) || 0;
    const minHeight = lineHeight * minRows + paddingTop + paddingBottom;
    const maxHeight = lineHeight * maxRows + paddingTop + paddingBottom;

    textarea.style.height = 'auto';
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [maxRows, minRows]);

  useEffect(() => {
    resize();
  }, [resize, value]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    let width = textarea.clientWidth;
    const resizeForWidth = () => {
      if (textarea.clientWidth === width) return;
      width = textarea.clientWidth;
      resize();
    };
    // Observe width only: changing our height must not trigger a resize loop.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resizeForWidth);
    observer?.observe(textarea);
    window.addEventListener('resize', resizeForWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resizeForWidth);
    };
  }, [resize]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      rows={Math.max(1, Math.ceil(minRows))}
      value={value}
      onInput={event => {
        resize();
        onInput?.(event);
      }}
      style={{ ...style, resize: props.readOnly ? 'none' : style?.resize }}
    />
  );
};

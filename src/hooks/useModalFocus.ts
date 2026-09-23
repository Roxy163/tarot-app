import { useLayoutEffect, useRef, type RefObject } from 'react';

const stack: HTMLElement[] = [];
const closeHandlers = new Map<HTMLElement, () => void>();
const selector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

// 系统返回与 Escape 共用层级；调用原关闭逻辑，保留未保存内容等保护。
export function closeTopModal() {
  const top = stack.at(-1);
  const close = top && closeHandlers.get(top);
  if (!close) return false;
  close();
  return true;
}

export function useModalFocus(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void, initialFocus?: RefObject<HTMLElement | null>) {
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    stack.push(dialog);
    closeHandlers.set(dialog, () => close.current());
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>(selector)].filter(element => {
      if (element.tabIndex < 0 || element.matches(':disabled, input[type="hidden"]')) return false;
      let node: HTMLElement | null = element;
      while (node && node !== dialog) {
        const style = getComputedStyle(node);
        if (node.hidden || node.inert || style.display === 'none' || style.visibility === 'hidden') return false;
        node = node.parentElement;
      }
      return true;
    }).sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    const focusFirst = () => (focusable()[0] || dialog).focus();
    // Focus after registering the dialog, so a parent trap cannot steal it.
    if (initialFocus?.current && focusable().includes(initialFocus.current)) initialFocus.current.focus();
    else if (!dialog.contains(document.activeElement)) focusFirst();
    const keydown = (event: KeyboardEvent) => {
      if (stack.at(-1) !== dialog || event.defaultPrevented || event.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        close.current();
      } else if (event.key === 'Tab') {
        const items = focusable();
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (!items.length) { event.preventDefault(); dialog.focus(); }
        else if (event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1)!.focus(); }
        else if (!event.shiftKey && (index === -1 || index === items.length - 1)) { event.preventDefault(); items[0].focus(); }
      }
    };
    const focusin = (event: FocusEvent) => {
      if (stack.at(-1) === dialog && !dialog.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', focusin);
    return () => {
      const wasTop = stack.at(-1) === dialog;
      const index = stack.indexOf(dialog);
      if (index >= 0) stack.splice(index, 1);
      closeHandlers.delete(dialog);
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', focusin);
      if (wasTop && previous?.isConnected) {
        previous.focus();
        const parent = stack.at(-1);
        // Exit animations can briefly re-focus an element being removed.
        requestAnimationFrame(() => {
          if (stack.at(-1) === parent && previous.isConnected) previous.focus();
        });
      }
    };
  }, [open, ref, initialFocus]);
}

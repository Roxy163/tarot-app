import { useEffect, useRef, useState } from 'react';
import type { PublicReadingLikeState } from '../types';
import { getPublicReadingLike, setPublicReadingLike } from '../lib/firebaseData';

export function usePublicReadingLikes(ids: string[], uid: string | undefined, onNotice?: (message: string) => void, onLogin?: () => void) {
  const [state, setState] = useState<{ uid?: string; likes: Record<string, PublicReadingLikeState> }>({ uid, likes: {} });
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const currentUser = useRef(uid);
  currentUser.current = uid;
  const inFlight = useRef(new Set<string>());
  const revisions = useRef(new Map<string, number>());
  const idsKey = JSON.stringify(ids);
  useEffect(() => {
    let active = true;
    setState(previous => previous.uid === uid ? previous : { uid, likes: {} });
    for (const id of JSON.parse(idsKey) as string[]) {
      const key = `${uid}:${id}`;
      const revision = revisions.current.get(key) || 0;
      void getPublicReadingLike(id, uid).then(value => {
        if (active && revision === (revisions.current.get(key) || 0) && !inFlight.current.has(key)) setState(previous => ({ uid, likes: { ...(previous.uid === uid ? previous.likes : {}), [id]: value } }));
      }).catch(() => { /* Counts stay unknown when offline; do not invent successful likes. */ });
    }
    return () => { active = false; };
  }, [idsKey, uid]);

  const toggle = async (id: string) => {
    if (!uid) { onNotice?.('登录后可以为这条分享点赞。'); onLogin?.(); return; }
    const key = `${uid}:${id}`;
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    revisions.current.set(key, (revisions.current.get(key) || 0) + 1);
    setPending(previous => ({ ...previous, [key]: true }));
    try {
      // Read fresh state first, including after switching accounts or a failed initial load.
      const existing = await getPublicReadingLike(id, uid);
      if (currentUser.current !== uid) return;
      const value = await setPublicReadingLike(id, uid, !existing.liked);
      if (currentUser.current === uid) setState(previous => ({ uid, likes: { ...(previous.uid === uid ? previous.likes : {}), [id]: value } }));
    } catch {
      if (currentUser.current === uid) onNotice?.('点赞暂时未能保存，请稍后再试。');
    } finally {
      inFlight.current.delete(key);
      setPending(previous => ({ ...previous, [key]: false }));
    }
  };
  return { likes: state.uid === uid ? state.likes : {}, isPending: (id: string) => Boolean(pending[`${uid}:${id}`]), toggle };
}

import type { Analytics } from 'firebase/analytics';
import { getFirebaseApp, isFirebaseReady } from './firebase';

type FirebaseAnalyticsApi = typeof import('firebase/analytics');

export type AnalyticsEventName =
  | 'app_open'
  | 'splash_enter'
  | 'tab_opened'
  | 'login_success'
  | 'logout'
  | 'pwa_install_requested'
  | 'pwa_install_result'
  | 'daily_deck_shuffled'
  | 'daily_fortune_saved'
  | 'daily_fortune_updated'
  | 'daily_reflection_saved'
  | 'daily_fortune_archived'
  | 'daily_annotation_saved'
  | 'daily_review_exported'
  | 'reading_saved'
  | 'reading_ai_processed'
  | 'archive_exported'
  | 'card_library_exported'
  | 'quiz_answered'
  | 'quiz_question_refreshed'
  | 'quiz_archive_opened'
  | 'quiz_keywords_saved';

export type AnalyticsParamValue = string | number | boolean | null | undefined;
export type AnalyticsParams = Record<string, AnalyticsParamValue>;

const SENSITIVE_PARAM_KEY_PATTERN =
  /(email|phone|name|client|customer|question|prompt|content|text|interpretation|reflection|note|password|token|secret|code|keyword|tag|uid)/i;

const MAX_EVENT_NAME_LENGTH = 40;
const MAX_PARAM_KEY_LENGTH = 40;
const MAX_STRING_VALUE_LENGTH = 80;
const CLOUDFLARE_BEACON_ID = 'tarot-cloudflare-web-analytics';
const CLOUDFLARE_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

let analyticsApiPromise: Promise<FirebaseAnalyticsApi> | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;

const isBrowser = () => typeof window !== 'undefined' && typeof navigator !== 'undefined';

const isJsdom = () => isBrowser() && navigator.userAgent.toLowerCase().includes('jsdom');

export const isAnalyticsConfigured = () => (
  isBrowser()
  && !isJsdom()
  && isFirebaseReady
  && Boolean(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID)
  && import.meta.env.VITE_ANALYTICS_DISABLED !== 'true'
);

const isDebugEnabled = () => import.meta.env.VITE_ANALYTICS_DEBUG === 'true';

const loadAnalyticsApi = async (): Promise<FirebaseAnalyticsApi> => {
  analyticsApiPromise ||= import('firebase/analytics');
  return analyticsApiPromise;
};

const getAnalyticsInstance = async (): Promise<Analytics | null> => {
  if (!isAnalyticsConfigured()) return null;

  analyticsPromise ||= (async () => {
    try {
      const api = await loadAnalyticsApi();
      const supported = await api.isSupported();
      if (!supported) return null;

      const app = await getFirebaseApp();
      return api.getAnalytics(app);
    } catch (error) {
      if (isDebugEnabled()) {
        console.info('[analytics] unavailable', error);
      }
      return null;
    }
  })();

  return analyticsPromise;
};

const normalizeParamKey = (key: string) => (
  key
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^([^a-zA-Z])/, 'p_$1')
    .slice(0, MAX_PARAM_KEY_LENGTH)
);

export const sanitizeAnalyticsParams = (params: AnalyticsParams = {}) => {
  const sanitized: Record<string, string | number | boolean> = {};

  Object.entries(params).forEach(([rawKey, rawValue]) => {
    const key = normalizeParamKey(rawKey);
    if (!key || SENSITIVE_PARAM_KEY_PATTERN.test(key)) return;
    if (rawValue === null || rawValue === undefined) return;

    if (typeof rawValue === 'string') {
      sanitized[key] = rawValue.slice(0, MAX_STRING_VALUE_LENGTH);
      return;
    }

    if (typeof rawValue === 'number') {
      if (Number.isFinite(rawValue)) sanitized[key] = rawValue;
      return;
    }

    if (typeof rawValue === 'boolean') {
      sanitized[key] = rawValue;
    }
  });

  return sanitized;
};

export const trackEvent = (eventName: AnalyticsEventName, params: AnalyticsParams = {}) => {
  const safeEventName = eventName.slice(0, MAX_EVENT_NAME_LENGTH) as AnalyticsEventName;
  const safeParams = sanitizeAnalyticsParams(params);

  if (isDebugEnabled()) {
    console.info('[analytics]', safeEventName, safeParams);
  }

  void getAnalyticsInstance().then(async analytics => {
    if (!analytics) return;

    try {
      const api = await loadAnalyticsApi();
      api.logEvent(analytics, safeEventName, safeParams);
    } catch (error) {
      if (isDebugEnabled()) {
        console.info('[analytics] log failed', safeEventName, error);
      }
    }
  });
};

export const setAnalyticsAuthState = (user: { uid?: string | null } | null | undefined) => {
  void getAnalyticsInstance().then(async analytics => {
    if (!analytics) return;

    try {
      const api = await loadAnalyticsApi();
      const uid = user?.uid || null;
      api.setUserProperties(analytics, {
        auth_state: uid ? 'signed_in' : 'guest',
      });
    } catch (error) {
      if (isDebugEnabled()) {
        console.info('[analytics] auth state failed', error);
      }
    }
  });
};

export const installCloudflareWebAnalytics = () => {
  if (!isBrowser() || isJsdom()) return;
  if (import.meta.env.VITE_ANALYTICS_DISABLED === 'true') return;

  const token = import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN;
  if (!token || typeof document === 'undefined') return;
  if (document.getElementById(CLOUDFLARE_BEACON_ID)) return;

  const script = document.createElement('script');
  script.id = CLOUDFLARE_BEACON_ID;
  script.defer = true;
  script.src = CLOUDFLARE_BEACON_SRC;
  script.dataset.cfBeacon = JSON.stringify({ token });
  document.head.appendChild(script);
};

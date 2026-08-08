import { afterEach, describe, expect, it } from 'vitest';
import { getTarotImageWarmupNetworkProfile } from './tarotImagePreload';

const setConnection = (connection: { saveData?: boolean; effectiveType?: string } | undefined) => {
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: connection,
  });
};

describe('tarot image preload network profile', () => {
  afterEach(() => {
    setConnection(undefined);
  });

  it('limits warmup when data saver is enabled', () => {
    setConnection({ saveData: true, effectiveType: '4g' });

    expect(getTarotImageWarmupNetworkProfile()).toBe('constrained');
  });

  it('limits warmup on very slow connections', () => {
    setConnection({ effectiveType: '2g' });

    expect(getTarotImageWarmupNetworkProfile()).toBe('constrained');
  });

  it('uses a moderate warmup on 3g connections', () => {
    setConnection({ effectiveType: '3g' });

    expect(getTarotImageWarmupNetworkProfile()).toBe('moderate');
  });

  it('keeps full warmup for normal connections', () => {
    setConnection({ effectiveType: '4g' });

    expect(getTarotImageWarmupNetworkProfile()).toBe('standard');
  });
});

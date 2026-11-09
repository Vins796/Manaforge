/**
 * @nature [TEST]
 * @module ExternalBrowserTest
 * @description Verifica che vengano aperti solo URL https, in una nuova finestra isolata.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/desktop-client/tests/services/external-browser.test.ts
 */
import { describe, expect, it, vi } from 'vitest';
import { createOpenExternal } from '../../src/services/external-browser.js';

describe('createOpenExternal', () => {
  it('apre gli URL https con noopener', () => {
    const open = vi.fn(() => null);
    expect(createOpenExternal(open)('https://accounts.google.com/x')).toBe(true);
    expect(open).toHaveBeenCalledWith('https://accounts.google.com/x', '_blank', 'noopener,noreferrer');
  });

  it.each(['javascript:alert(1)', 'http://insicuro.test', 'file:///etc/passwd', 'non un url'])('rifiuta %s', (url) => {
    const open = vi.fn();
    expect(createOpenExternal(open)(url)).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('segnala il fallimento dell\'apertura e usa window.open di default', () => {
    expect(createOpenExternal(() => false)('https://x.test')).toBe(false);
    const spy = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(createOpenExternal()('https://x.test/')).toBe(true);
    expect(spy).toHaveBeenCalledWith('https://x.test/', '_blank', 'noopener,noreferrer');
    spy.mockRestore();
  });
});

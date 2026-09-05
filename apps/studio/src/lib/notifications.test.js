import { describe, it, expect } from 'vitest';
import { shouldRetireReminderPrompt, shouldOfferReminders } from './notifications.js';

// The bug these tests exist for: the reminders card wrote its
// "don't ask again" flag after EVERY outcome of Notification.requestPermission,
// including 'default' - which is what the browser returns when the user
// dismisses its prompt without choosing. So dismissing the browser bubble
// once retired the only affordance for enabling reminders, permanently,
// while leaving permission at 'default'. Enabled never, asked never again.

describe('shouldRetireReminderPrompt', () => {
  it('retires the prompt once permission is granted', () => {
    expect(shouldRetireReminderPrompt('granted')).toBe(true);
  });

  it('retires the prompt once permission is denied — the browser will not ask again', () => {
    expect(shouldRetireReminderPrompt('denied')).toBe(true);
  });

  it('does NOT retire the prompt when the user dismissed the browser without deciding', () => {
    // This is the regression. 'default' means no decision was made, so the
    // offer must survive for next time.
    expect(shouldRetireReminderPrompt('default')).toBe(false);
  });

  it('does NOT retire the prompt for an unrecognised or missing outcome', () => {
    expect(shouldRetireReminderPrompt(undefined)).toBe(false);
    expect(shouldRetireReminderPrompt(null)).toBe(false);
    expect(shouldRetireReminderPrompt('something-else')).toBe(false);
  });
});

describe('shouldOfferReminders', () => {
  const base = { permission: 'default', retired: false, itemCount: 10 };

  it('offers when permission is undecided, nothing is retired and there is content', () => {
    expect(shouldOfferReminders(base)).toBe(true);
  });

  it('does not offer once the user has retired the prompt', () => {
    expect(shouldOfferReminders({ ...base, retired: true })).toBe(false);
  });

  it('does not offer when permission is already granted', () => {
    expect(shouldOfferReminders({ ...base, permission: 'granted' })).toBe(false);
  });

  it('does not offer when permission is denied', () => {
    expect(shouldOfferReminders({ ...base, permission: 'denied' })).toBe(false);
  });

  it('waits until the wardrobe has more than a couple of pieces', () => {
    expect(shouldOfferReminders({ ...base, itemCount: 2 })).toBe(false);
    expect(shouldOfferReminders({ ...base, itemCount: 3 })).toBe(true);
  });

  it('does not offer when the browser has no Notification API', () => {
    expect(shouldOfferReminders({ ...base, permission: null })).toBe(false);
  });
});

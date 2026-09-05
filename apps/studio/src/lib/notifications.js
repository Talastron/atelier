// Reminder-prompt policy, kept out of the component so it can be reasoned
// about and tested. The view's job is to render and to talk to the browser;
// deciding WHEN to offer and WHEN to stop offering is a rule, and rules belong
// here alongside pickVeto and seasonsForTemp.

// Should the reminders offer retire itself — never be shown again?
//
// The distinction this function exists to make: 'default' is not a decision.
// Notification.requestPermission() resolves 'default' when the user dismisses
// the browser's own prompt without choosing — closes the bubble, clicks away,
// or never notices it at all under Chrome's quiet permission UI, where the
// request appears only as a small icon in the address bar.
//
// Treating that as "asked and answered" is what broke this: one dismissal
// retired the card for good, leaving permission at 'default' forever. Enabled
// never, asked never again, with no way back short of clearing site data.
//
// So only a real decision retires the offer. 'granted' means there is nothing
// left to ask; 'denied' means the browser will not prompt again, so continuing
// to offer would be a button that cannot work.
export function shouldRetireReminderPrompt(outcome) {
  return outcome === 'granted' || outcome === 'denied';
}

// Should the reminders card be offered at all right now?
//
// `permission` is Notification.permission, or null when the browser has no
// Notification API. `retired` is the stored "don't ask again" flag.
// `itemCount` gates the offer until the wardrobe has enough in it that
// reminders would have something to talk about — asking on an empty wardrobe
// is asking for a favour before giving anything.
export function shouldOfferReminders({ permission, retired, itemCount } = {}) {
  if (permission !== 'default') return false;
  if (retired) return false;
  return (itemCount || 0) > 2;
}

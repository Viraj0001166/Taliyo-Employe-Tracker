// utils/licenseCheck.js
// Client-side license validation utility

export function checkLicense() {
  if (typeof window === 'undefined') return true; // SSR/Edge safety

  const host = (window.location?.hostname || '').toLowerCase();

  // Skip check on the official domain
  if (host === 'taliyotechnologies.com') {
    return true;
  }

  try {
    const expectedKey = process.env.NEXT_PUBLIC_LICENSE_KEY || '';
    const storedKey = window.localStorage.getItem('license_key') || '';

    if (!expectedKey || !storedKey || storedKey !== expectedKey) {
      // Show alert and redirect to contact page
      window.alert(
        '⚠️ Invalid License! Please contact Taliyo Technologies for a valid license key.'
      );
      window.location.href = 'https://taliyotechnologies.com/contact';
      return false;
    }

    return true;
  } catch (err) {
    // If anything goes wrong, fail open to avoid breaking the app unexpectedly
    // eslint-disable-next-line no-console
    console.warn('[License] Skipping validation due to runtime error:', err);
    return true;
  }
}

/**
 * SpinShot 360 — Guest landing link
 * Guests scan a QR / open a shared link. Instead of the raw video file, they
 * land on a branded page (docs/v.html on GitHub Pages) that plays the video
 * and invites them to get the app — the main organic acquisition loop.
 */

const GUEST_PAGE = 'https://luizproenca.github.io/SpinShot/v.html';

export function buildGuestUrl(videoUrl: string | undefined | null): string {
  if (!videoUrl || !/^https:\/\//i.test(videoUrl)) return videoUrl ?? '';
  return `${GUEST_PAGE}?u=${encodeURIComponent(videoUrl)}`;
}

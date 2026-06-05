const visitorKey = 'photo-memory-comment-visitor';

export const readGuestProfile = () => {
  try {
    const profile = JSON.parse(localStorage.getItem(visitorKey) || '{}');
    return {
      guestName: String(profile.guestName || ''),
      guestEmail: String(profile.guestEmail || '')
    };
  } catch {
    return { guestName: '', guestEmail: '' };
  }
};

export const saveGuestProfile = ({ guestName, guestEmail }) => {
  localStorage.setItem(visitorKey, JSON.stringify({
    guestName: String(guestName || '').trim(),
    guestEmail: String(guestEmail || '').trim()
  }));
};

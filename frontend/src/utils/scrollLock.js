const activeLocks = new Set();
let previousState = null;

const scrollbarWidth = () => Math.max(0, window.innerWidth - document.documentElement.clientWidth);

const lockPage = () => {
  if (previousState) return;
  const width = scrollbarWidth();
  previousState = {
    bodyOverflow: document.body.style.overflow,
    bodyPaddingRight: document.body.style.paddingRight,
    htmlOverflow: document.documentElement.style.overflow
  };
  document.documentElement.classList.add('app-scroll-locked');
  document.body.classList.add('app-scroll-locked');
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  if (width > 0) {
    const currentPadding = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
    document.body.style.paddingRight = `${currentPadding + width}px`;
  }
};

const unlockPage = () => {
  if (!previousState) return;
  document.documentElement.classList.remove('app-scroll-locked');
  document.body.classList.remove('app-scroll-locked');
  document.documentElement.style.overflow = previousState.htmlOverflow;
  document.body.style.overflow = previousState.bodyOverflow;
  document.body.style.paddingRight = previousState.bodyPaddingRight;
  previousState = null;
};

export const setPageScrollLocked = (key, locked) => {
  if (!key) return;
  if (locked) activeLocks.add(key);
  else activeLocks.delete(key);
  if (activeLocks.size) lockPage();
  else unlockPage();
};

export const unlockPageScroll = (key) => {
  setPageScrollLocked(key, false);
};

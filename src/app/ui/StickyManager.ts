import { dom } from '../../config/dom';
import { DESKTOP_BREAKPOINT_PX } from '../../config/constants';

export class StickyManager {
  constructor() {
    this.setupStickyBehavior();
  }

  private setupStickyBehavior(): void {
    const { qrPreviewColumn, canvasContainer, bottomContentContainer } = dom;

    const stickyContainer = qrPreviewColumn.querySelector(
      '.qr-sticky-container'
    ) as HTMLDivElement;

    if (!stickyContainer || !canvasContainer || !bottomContentContainer) return;

    const canvasPlaceholder = document.createElement('div');
    canvasPlaceholder.className = 'sticky-placeholder';
    canvasContainer.before(canvasPlaceholder);

    const desktopOffset = 32;
    const mobileOffset = 16;
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDirection = currentScrollY > lastScrollY ? 'down' : 'up';
      if (Math.abs(currentScrollY - lastScrollY) > 1) {
        lastScrollY = currentScrollY;
      }

      if (window.innerWidth >= DESKTOP_BREAKPOINT_PX) {
        // --- DESKTOP LOGIC ---
        if (canvasContainer.classList.contains('is-stuck-mobile')) {
          canvasContainer.classList.remove('is-stuck-mobile');
          canvasContainer.style.left = '';
          canvasContainer.style.width = '';
          canvasPlaceholder.style.height = `0px`;
          canvasPlaceholder.style.width = `0px`;
        }

        const isStuck = canvasContainer.classList.contains('is-stuck-desktop');
        const stickyContainerRect = stickyContainer.getBoundingClientRect();
        const parentColumnRect = qrPreviewColumn.getBoundingClientRect();

        if (!isStuck) {
          const canvasRect = canvasContainer.getBoundingClientRect();
          const isBottomedOut =
            stickyContainerRect.bottom >= parentColumnRect.bottom - 1;
          const isAtTop = canvasRect.top <= desktopOffset;

          if (isBottomedOut && isAtTop && scrollDirection === 'down') {
            const { width, height, left } = canvasRect;
            canvasPlaceholder.style.width = `${width}px`;
            canvasPlaceholder.style.height = `${height}px`;

            canvasContainer.classList.add('is-stuck-desktop');
            canvasContainer.style.left = `${left}px`;
            canvasContainer.style.width = `${width}px`;

            bottomContentContainer.classList.add('is-reflowing');
          }
        } else {
          // Recalculate position and width on resize
          const placeholderRect = canvasPlaceholder.getBoundingClientRect();
          canvasContainer.style.left = `${placeholderRect.left}px`;
          canvasContainer.style.width = `${placeholderRect.width}px`;

          if (
            canvasPlaceholder.getBoundingClientRect().top >= desktopOffset &&
            scrollDirection === 'up'
          ) {
            canvasContainer.classList.remove('is-stuck-desktop');
            canvasContainer.style.left = '';
            canvasContainer.style.width = '';
            canvasPlaceholder.style.height = '0px';
            canvasPlaceholder.style.width = `0px`;

            bottomContentContainer.classList.remove('is-reflowing');
          }
        }
      } else {
        // --- MOBILE LOGIC ---
        if (canvasContainer.classList.contains('is-stuck-desktop')) {
          canvasContainer.classList.remove('is-stuck-desktop');
          canvasContainer.style.left = '';
          canvasContainer.style.width = '';
          canvasPlaceholder.style.height = '0px';
          canvasPlaceholder.style.width = `0px`;
          bottomContentContainer.classList.remove('is-reflowing');
        }

        const isStuck = canvasContainer.classList.contains('is-stuck-mobile');

        if (!isStuck) {
          if (
            canvasContainer.getBoundingClientRect().top <= mobileOffset &&
            scrollDirection === 'down'
          ) {
            const { width, height, left } =
              canvasContainer.getBoundingClientRect();
            canvasPlaceholder.style.width = `${width}px`;
            canvasPlaceholder.style.height = `${height}px`;
            canvasContainer.classList.add('is-stuck-mobile');
            canvasContainer.style.width = `${width}px`;
            canvasContainer.style.left = `${left}px`;
          }
        } else {
          const placeholderRect = canvasPlaceholder.getBoundingClientRect();
          canvasContainer.style.width = `${placeholderRect.width}px`;
          canvasContainer.style.left = `${placeholderRect.left}px`;

          if (placeholderRect.top >= mobileOffset && scrollDirection === 'up') {
            canvasContainer.classList.remove('is-stuck-mobile');
            canvasContainer.style.width = '';
            canvasContainer.style.left = '';
            canvasPlaceholder.style.height = '0px';
            canvasPlaceholder.style.width = `0px`;
          }
        }
      }
    };

    let ticking = false;
    const throttledScrollHandler = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', throttledScrollHandler);
    window.addEventListener('resize', throttledScrollHandler);
  }
}

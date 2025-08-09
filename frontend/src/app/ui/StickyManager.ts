// src/app/ui/StickyManager.ts

import { dom } from '../../config/dom';
import { DESKTOP_BREAKPOINT_PX } from '../../config/constants';

export class StickyManager {
  private lastScrollY = 0;

  constructor() {
    this.setupStickyBehavior();
  }

  public handleStickyBehavior = (): void => {
    const {
      contentWrapper,
      canvasContainer,
      mainGrid,
      advancedControls,
      qrPreviewColumn,
      formColumn,
      qrcodeTextContainer,
      qrStickyContainer,
      qrPreviewColumnFooter,
    } = dom;

    const isMobile = window.innerWidth < DESKTOP_BREAKPOINT_PX;
    const currentScrollY = window.scrollY;
    const isScrollingUp = currentScrollY < this.lastScrollY;
    const isScrollingDown = !isScrollingUp;

    if (isMobile) {
      if (
        contentWrapper &&
        canvasContainer &&
        mainGrid &&
        canvasContainer.parentNode !== contentWrapper
      ) {
        mainGrid.before(canvasContainer);
      }
    } else {
      if (
        qrPreviewColumn &&
        canvasContainer &&
        !qrPreviewColumn.contains(canvasContainer)
      ) {
        qrPreviewColumn.prepend(canvasContainer);
      }

      if (
        qrcodeTextContainer &&
        formColumn &&
        advancedControls.container &&
        qrPreviewColumn
      ) {
        const qrcodeTextContainerRect =
          qrcodeTextContainer.getBoundingClientRect();
        const qrStickyContainerRect = formColumn.getBoundingClientRect();

        if (
          qrcodeTextContainerRect.bottom >= qrStickyContainerRect.bottom &&
          isScrollingDown
        ) {
          advancedControls.container.classList.remove('both-columns');
          qrPreviewColumn.classList.add('both-rows');
        }

        if (
          qrcodeTextContainerRect.bottom < qrStickyContainerRect.bottom &&
          isScrollingUp
        ) {
          advancedControls.container.classList.add('both-columns');
          qrPreviewColumn.classList.remove('both-rows');
        }
      }

      const contentWrapperRect = contentWrapper.getBoundingClientRect();
      const canvasRect = canvasContainer.getBoundingClientRect();
      const formColumnRect = formColumn.getBoundingClientRect();
      const previewColumnRect = qrPreviewColumn.getBoundingClientRect();
      const previewFooterRect = qrPreviewColumnFooter.getBoundingClientRect();
      const advancedControlsRect =
        advancedControls.container.getBoundingClientRect();

      const calculatedPreviewFooterRectTop =
        previewColumnRect.top + canvasRect.height;

      const overlap = canvasRect.bottom - calculatedPreviewFooterRectTop;
      const previewFooterBottomOffset =
        canvasRect.top +
        canvasRect.height +
        previewFooterRect.height -
        overlap -
        window.innerHeight;

      const contentWrapperBottomOffset =
        contentWrapperRect.bottom < window.innerHeight
          ? window.innerHeight - contentWrapperRect.bottom
          : 0;

      const contentExceedsViewport =
        canvasRect.height + previewFooterRect.height > window.innerHeight;

      const formColumnTotalHeight =
        formColumnRect.height + advancedControlsRect.height;
      const previewColumnTotalHeight =
        canvasRect.height + previewFooterRect.height;

      const previewColumnSmaller =
        previewColumnTotalHeight < formColumnTotalHeight;

      if (contentExceedsViewport) {
        if (qrPreviewColumnFooter.parentNode === qrStickyContainer) {
          qrPreviewColumn.appendChild(qrPreviewColumnFooter);
        }
      }

      const footerShouldStick =
        contentExceedsViewport &&
        previewColumnSmaller &&
        previewFooterBottomOffset < -32; //2rem to match stuck position

      if (footerShouldStick) {
        const footerStickBottomPosition = contentWrapperBottomOffset + 32;
        qrPreviewColumnFooter.classList.add('sticky-footer');
        qrPreviewColumnFooter.style.bottom = `${footerStickBottomPosition}px`;
      } else {
        qrPreviewColumnFooter.classList.remove('sticky-footer');
      }
    }

    this.lastScrollY = currentScrollY;
  };

  private setupStickyBehavior(): void {
    this.handleStickyBehavior();
    window.addEventListener('scroll', this.handleStickyBehavior);
    window.addEventListener('resize', this.handleStickyBehavior);
  }
}

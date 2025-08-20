// src/app/ui/StickyManager.ts

import { dom } from '../../config/dom';
import { DESKTOP_BREAKPOINT_PX } from '../../config/constants';
import { UIManager } from '../UIManager';

/**
 * A structured object to hold all necessary DOM elements and their dimensions (DOMRects).
 * This avoids repetitive DOM queries and layout calculations.
 */
type LayoutData = {
  elements: {
    contentWrapper: HTMLElement;
    canvasContainer: HTMLElement;
    qrStickyContainer: HTMLElement;
    qrCanvasPlaceholder: HTMLElement;
    qrPreviewColumn: HTMLElement;
    qrPreviewColumnFooter: HTMLElement;
    formColumn: HTMLElement;
    activeForm: HTMLElement | null;
    qrcodeTextContainer: HTMLElement;
    advancedControlsContainer: HTMLElement;
  };
  rects: {
    contentWrapperRect: DOMRect;
    canvasRect: DOMRect;
    formColumnRect: DOMRect;
    previewColumnRect: DOMRect;
    previewFooterRect: DOMRect;
    advancedControlsRect: DOMRect;
    qrcodeTextContainerRect: DOMRect;
  };
};

export class StickyManager {
  private lastScrollY = 0;
  private stickyContainerTop = 0;
  private initialCanvasHeight = 0;
  private initialCanvasWidth = 0;
  private mobileCanvasTop: number | null = null;
  private uiManager: UIManager;

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
    this.reInitializeDimensions();
    this.setupEventListeners();
  }

  public reInitializeDimensions(): void {
    const { canvasContainer, qrStickyContainer } = dom;
    if (canvasContainer && qrStickyContainer) {
      this.stickyContainerTop = qrStickyContainer.offsetTop;
      this.initialCanvasHeight = canvasContainer.offsetHeight;
      this.initialCanvasWidth = canvasContainer.offsetWidth;
      this.mobileCanvasTop = null; // Reset on resize to force recalculation
    }
  }

  /**
   * Main handler that orchestrates all sticky behaviors.
   */
  public handleStickyBehavior = (isResizeEvent = false): void => {
    const isMobile = window.innerWidth < DESKTOP_BREAKPOINT_PX;

    if (isMobile) {
      this._resetDesktopStyles(); // Clean up desktop state first
      this.handleMobileCanvasLayout();
      if (isResizeEvent) this.reInitializeDimensions(); // Recalc after DOM change
      this._handleMobileStickyQr();
    } else {
      this._resetMobileStyles();
      this.handleDesktopCanvasLayout();
      if (isResizeEvent) this.reInitializeDimensions(); // Recalc after DOM change

      const layoutData = this._getLayoutData();
      if (!layoutData) {
        this.lastScrollY = window.scrollY;
        return;
      }
      const contentExceedsViewport =
        this.initialCanvasHeight + layoutData.rects.previewFooterRect.height >
        window.innerHeight;

      if (contentExceedsViewport) {
        this._ensureOriginalDomStructure(layoutData);
        this._unstickFullColumn(layoutData);
        this._updateShrinkingColumnLayout(layoutData);
        this.handleStickyFooter(layoutData);
        this.handleQrCodeResizing(layoutData);
      } else {
        this._handleStickyFullColumn(layoutData);
        this._updateFullColumnLayout(layoutData);
      }
    }
    this.lastScrollY = window.scrollY;
  };

  /**
   * A dedicated cleanup function to reset desktop-specific styles.
   */
  private _resetDesktopStyles(): void {
    const { canvasContainer, qrCanvasPlaceholder, qrPreviewColumnFooter } = dom;
    if (canvasContainer) {
      canvasContainer.classList.remove('is-sticky');
      canvasContainer.style.width = '';
      canvasContainer.style.transform = '';
      canvasContainer.style.transformOrigin = '';
    }
    if (qrCanvasPlaceholder) {
      qrCanvasPlaceholder.style.height = '0px';
    }
    if (qrPreviewColumnFooter) {
      qrPreviewColumnFooter.classList.remove('sticky-footer');
      qrPreviewColumnFooter.style.bottom = '';
    }
  }

  /**
   * A dedicated cleanup function to reset mobile-specific styles.
   */
  private _resetMobileStyles(): void {
    const { canvasContainer } = dom;
    if (canvasContainer) {
      canvasContainer.classList.remove('is-mobile-transformed');
      canvasContainer.style.transform = '';
    }
  }

  private _handleMobileStickyQr(): void {
    const { canvasContainer } = dom;
    if (!canvasContainer) return;

    if (this.mobileCanvasTop === null) {
      const header = document.querySelector('.header-section') as HTMLElement;
      if (header) {
        const headerRect = header.getBoundingClientRect();
        const headerStyle = window.getComputedStyle(header);
        const headerMarginBottom = parseFloat(headerStyle.marginBottom);
        this.mobileCanvasTop =
          headerRect.bottom + headerMarginBottom + window.scrollY;
      } else {
        this.mobileCanvasTop =
          canvasContainer.getBoundingClientRect().top + window.scrollY;
      }
      this.initialCanvasWidth =
        canvasContainer.querySelector('canvas')?.offsetWidth ||
        this.initialCanvasHeight;
    }

    const scrollThreshold = this.mobileCanvasTop;
    const currentScroll = window.scrollY;

    if (currentScroll > scrollThreshold) {
      canvasContainer.classList.add('is-mobile-transformed');

      const scrollPast = currentScroll - scrollThreshold;
      const minHeight = window.innerHeight * 0.33;

      const newHeight = this.initialCanvasHeight - scrollPast;
      const clampedHeight = Math.max(minHeight, newHeight);
      const finalHeight = Math.min(clampedHeight, this.initialCanvasHeight);
      const scaleFactor =
        finalHeight > 0 ? finalHeight / this.initialCanvasHeight : 0;

      const maxScrollDistance = this.initialCanvasHeight - minHeight;
      const progress =
        maxScrollDistance > 0 ? Math.min(1, scrollPast / maxScrollDistance) : 1;

      const currentWidth = this.initialCanvasWidth * scaleFactor;
      const targetCenterX = window.innerWidth - currentWidth / 2;
      const initialCenterX = window.innerWidth / 2;
      const translateX = progress * (targetCenterX - initialCenterX);

      canvasContainer.style.transform = `translateX(${translateX}px) scale(${scaleFactor})`;
    } else {
      canvasContainer.classList.remove('is-mobile-transformed');
      canvasContainer.style.transform = 'translateX(0) scale(1)';
    }
  }

  private _updateFullColumnLayout(data: LayoutData): void {
    const { advancedControlsContainer, qrPreviewColumn, activeForm } =
      data.elements;
    const { previewColumnRect, qrcodeTextContainerRect } = data.rects;

    if (advancedControlsContainer.classList.contains('hidden')) {
      advancedControlsContainer.classList.add('both-columns');
      qrPreviewColumn.classList.remove('both-rows');
      return;
    }

    if (activeForm) {
      // Use the bottom of the text container relative to the top of the column
      // for a more stable height calculation, preventing layout feedback loops.
      const previewContentHeight =
        qrcodeTextContainerRect.bottom - previewColumnRect.top;
      const formContentHeight = activeForm.offsetHeight;

      const isPreviewTaller = previewContentHeight > formContentHeight;
      const isScrolledToTop = this.stickyContainerTop - window.scrollY <= 8;

      // If the preview column is taller OR the user has scrolled the sticky
      // container to the top, move the advanced controls into the preview column.
      if (isPreviewTaller || isScrolledToTop) {
        advancedControlsContainer.classList.remove('both-columns');
        qrPreviewColumn.classList.add('both-rows');
      } else {
        advancedControlsContainer.classList.add('both-columns');
        qrPreviewColumn.classList.remove('both-rows');
      }
    }
  }

  private _handleStickyFullColumn(data: LayoutData): void {
    const { qrStickyContainer, qrPreviewColumnFooter, canvasContainer } =
      data.elements;
    const { contentWrapperRect, previewFooterRect } = data.rects;

    if (!qrStickyContainer.contains(qrPreviewColumnFooter)) {
      qrStickyContainer.appendChild(qrPreviewColumnFooter);
    }
    qrStickyContainer.classList.add('is-full-sticky');
    this._resetShrinkingColumnStyles(data);

    const topOffset = 8;
    const bottomIntrusion = Math.max(
      0,
      window.innerHeight - contentWrapperRect.bottom
    );
    const fullStickyElementHeight =
      this.initialCanvasHeight + previewFooterRect.height;
    const availableHeight = window.innerHeight - topOffset - bottomIntrusion;

    if (fullStickyElementHeight > availableHeight) {
      const newCanvasHeight = availableHeight - previewFooterRect.height;
      let scaleFactor = newCanvasHeight / this.initialCanvasHeight;

      if (scaleFactor > 1) scaleFactor = 1;
      if (scaleFactor < 0) scaleFactor = 0;

      canvasContainer.style.transformOrigin = 'top center';
      canvasContainer.style.transform = `scale(${scaleFactor})`;
    } else {
      canvasContainer.style.transform = 'scale(1)';
      canvasContainer.style.transformOrigin = '';
    }
  }

  private _resetShrinkingColumnStyles(data: LayoutData): void {
    const { canvasContainer, qrCanvasPlaceholder, qrPreviewColumnFooter } =
      data.elements;

    canvasContainer.classList.remove('is-sticky');
    qrCanvasPlaceholder.style.height = '0px';
    canvasContainer.style.transform = 'scale(1)';
    canvasContainer.style.width = '';
    canvasContainer.style.transformOrigin = '';

    qrPreviewColumnFooter.classList.remove('sticky-footer');
    qrPreviewColumnFooter.style.bottom = '';
  }

  private _ensureOriginalDomStructure(data: LayoutData): void {
    const { qrPreviewColumn, qrStickyContainer, qrPreviewColumnFooter } =
      data.elements;
    if (
      qrPreviewColumn &&
      qrStickyContainer &&
      qrPreviewColumnFooter &&
      qrStickyContainer.contains(qrPreviewColumnFooter)
    ) {
      qrPreviewColumn.appendChild(qrPreviewColumnFooter);
    }
  }

  private _unstickFullColumn(data: LayoutData): void {
    data.elements.qrStickyContainer?.classList.remove('is-full-sticky');
  }

  private _getLayoutData(): LayoutData | null {
    const {
      contentWrapper,
      canvasContainer,
      qrStickyContainer,
      qrCanvasPlaceholder,
      qrPreviewColumn,
      qrPreviewColumnFooter,
      formColumn,
      qrcodeTextContainer,
      advancedControls,
    } = dom;

    const advancedControlsContainer = advancedControls.container;

    if (
      !contentWrapper ||
      !canvasContainer ||
      !qrStickyContainer ||
      !qrCanvasPlaceholder ||
      !qrPreviewColumn ||
      !qrPreviewColumnFooter ||
      !formColumn ||
      !qrcodeTextContainer ||
      !advancedControlsContainer
    ) {
      return null;
    }

    const currentMode = this.uiManager.getCurrentMode();
    const activeForm = formColumn.querySelector<HTMLElement>(
      `#${currentMode}-form`
    );
    return {
      elements: {
        contentWrapper,
        canvasContainer,
        qrStickyContainer,
        qrCanvasPlaceholder,
        qrPreviewColumn,
        qrPreviewColumnFooter,
        formColumn,
        activeForm,
        qrcodeTextContainer,
        advancedControlsContainer,
      },
      rects: {
        contentWrapperRect: contentWrapper.getBoundingClientRect(),
        canvasRect: canvasContainer.getBoundingClientRect(),
        formColumnRect: formColumn.getBoundingClientRect(),
        previewColumnRect: qrPreviewColumn.getBoundingClientRect(),
        previewFooterRect: qrPreviewColumnFooter.getBoundingClientRect(),
        advancedControlsRect: advancedControlsContainer.getBoundingClientRect(),
        qrcodeTextContainerRect: qrcodeTextContainer.getBoundingClientRect(),
      },
    };
  }

  private handleQrCodeResizing(data: LayoutData): void {
    const { elements, rects } = data;
    const { canvasContainer, qrCanvasPlaceholder, qrPreviewColumnFooter } =
      elements;

    const currentScrollY = window.scrollY;
    const topOffset = 8;
    const bottomOffset = window.innerHeight - rects.previewFooterRect.bottom;
    const relativeStickyTop = this.stickyContainerTop - currentScrollY;

    if (relativeStickyTop <= topOffset) {
      canvasContainer.classList.add('is-sticky');
      qrCanvasPlaceholder.style.height = `${this.initialCanvasHeight}px`;

      const scrollPast = topOffset - relativeStickyTop;
      const newHeight = this.initialCanvasHeight - scrollPast;
      const minHeight = window.innerHeight * 0.25;
      const availableHeight =
        rects.previewFooterRect.top - rects.canvasRect.top;
      const availableFullCol =
        window.innerHeight -
        qrPreviewColumnFooter.offsetHeight -
        topOffset -
        bottomOffset;

      const clampedHeight = Math.max(
        minHeight,
        availableHeight,
        newHeight,
        availableFullCol
      );

      let scaleFactor = clampedHeight / this.initialCanvasHeight;
      if (scaleFactor > 1) scaleFactor = 1;

      canvasContainer.style.transform = `scale(${scaleFactor})`;
      canvasContainer.style.width = `${rects.previewColumnRect.width}px`;
    } else {
      canvasContainer.classList.remove('is-sticky');
      qrCanvasPlaceholder.style.height = '0px';
      canvasContainer.style.transform = 'scale(1)';
      canvasContainer.style.width = '';
    }
  }

  private _updateShrinkingColumnLayout(data: LayoutData): void {
    const { elements, rects } = data;
    const { advancedControlsContainer, qrPreviewColumn } = elements;

    const isScrollingDown = window.scrollY > this.lastScrollY;

    if (
      isScrollingDown &&
      rects.qrcodeTextContainerRect.bottom >= rects.formColumnRect.bottom
    ) {
      advancedControlsContainer.classList.remove('both-columns');
      qrPreviewColumn.classList.add('both-rows');
    } else if (
      !isScrollingDown &&
      rects.qrcodeTextContainerRect.bottom < rects.formColumnRect.bottom
    ) {
      advancedControlsContainer.classList.add('both-columns');
      qrPreviewColumn.classList.remove('both-rows');
    }
  }

  private handleStickyFooter(data: LayoutData): void {
    const { elements, rects } = data;
    const { canvasContainer, qrPreviewColumnFooter } = elements;

    const contentExceedsViewport =
      this.initialCanvasHeight + rects.previewFooterRect.height >
      window.innerHeight;

    const calculatedPreviewFooterRectTop =
      rects.previewColumnRect.top + canvasContainer.offsetHeight;
    const overlap =
      rects.canvasRect.top +
      this.initialCanvasHeight -
      calculatedPreviewFooterRectTop;
    const previewFooterBottomOffset =
      rects.canvasRect.top +
      this.initialCanvasHeight +
      rects.previewFooterRect.height -
      overlap -
      window.innerHeight;

    const previewColumnTotalHeight =
      this.initialCanvasHeight + rects.previewFooterRect.height;
    const formColumnTotalHeight =
      rects.formColumnRect.height + rects.advancedControlsRect.height;
    const previewColumnSmaller =
      previewColumnTotalHeight < formColumnTotalHeight;

    const footerShouldStick =
      contentExceedsViewport &&
      previewColumnSmaller &&
      previewFooterBottomOffset < -32;

    if (footerShouldStick) {
      const contentWrapperBottomOffset =
        rects.contentWrapperRect.bottom < window.innerHeight
          ? window.innerHeight - rects.contentWrapperRect.bottom
          : 0;
      const footerStickBottomPosition = contentWrapperBottomOffset + 32;
      qrPreviewColumnFooter.classList.add('sticky-footer');
      qrPreviewColumnFooter.style.bottom = `${footerStickBottomPosition}px`;
    } else {
      qrPreviewColumnFooter.classList.remove('sticky-footer');
      qrPreviewColumnFooter.style.bottom = '';
    }
  }

  private handleMobileCanvasLayout(): void {
    const { contentWrapper, canvasContainer, mainGrid, qrCanvasPlaceholder } =
      dom;
    if (
      contentWrapper &&
      canvasContainer &&
      mainGrid &&
      canvasContainer.parentNode !== contentWrapper
    ) {
      mainGrid.before(canvasContainer);
    }
    if (qrCanvasPlaceholder) {
      qrCanvasPlaceholder.style.display = 'none';
    }
  }

  private handleDesktopCanvasLayout(): void {
    const { qrStickyContainer, canvasContainer, qrCanvasPlaceholder } = dom;
    if (
      qrStickyContainer &&
      canvasContainer &&
      !qrStickyContainer.contains(canvasContainer)
    ) {
      qrStickyContainer.prepend(canvasContainer);
    }
    if (qrCanvasPlaceholder) {
      qrCanvasPlaceholder.style.display = '';
    }
  }

  private setupEventListeners(): void {
    window.addEventListener('scroll', () => this.handleStickyBehavior(false));
    window.addEventListener('resize', () => this.handleStickyBehavior(true));
  }
}

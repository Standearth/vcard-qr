// frontend/src/app/ui/StickyManager.ts

import { dom } from '../../config/dom';
import { DESKTOP_BREAKPOINT_PX, Mode } from '../../config/constants';
import { UIManager } from '../UIManager';

const TOP_OFFSET = 8;

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
  private advancedControlsMoved: Partial<Record<Mode, boolean>> = {};

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
    this.setupEventListeners();
    setTimeout(() => this.reInitializeDimensions(), 500);
  }

  public reInitializeDimensions(): void {
    const { canvasContainer, qrStickyContainer } = dom;
    if (canvasContainer && qrStickyContainer) {
      this.stickyContainerTop = qrStickyContainer.offsetTop;
      this.initialCanvasHeight = canvasContainer.offsetHeight;
      this.initialCanvasWidth = canvasContainer.offsetWidth;
      this.mobileCanvasTop = null;
    }
  }

  public handleStickyBehavior = (isResizeEvent = false): void => {
    if (this.initialCanvasHeight === 0 && !isResizeEvent) return;

    const isMobile = window.innerWidth < DESKTOP_BREAKPOINT_PX;

    if (isMobile) {
      this.handleMobileLayout(isResizeEvent);
    } else {
      this.handleDesktopLayout(isResizeEvent);
    }
    this.lastScrollY = window.scrollY;
  };

  private handleMobileLayout(isResizeEvent: boolean): void {
    this.resetDesktopStyles();
    this.setupMobileDOM();
    if (isResizeEvent) {
      this.reInitializeDimensions();
      this.mobileCanvasTop = null; // Force recalculation on resize
    }
    this.applyMobileStickyEffect();
  }

  private handleDesktopLayout(isResizeEvent: boolean): void {
    this.resetMobileStyles();
    this.resetDesktopStyles(); // Added this line
    this.setupDesktopDOM();
    if (isResizeEvent) this.reInitializeDimensions();

    const layoutData = this.getLayoutData();
    if (!layoutData) {
      this.lastScrollY = window.scrollY;
      return;
    }

    this.manageAdvancedControlsLayout(layoutData);

    const contentExceedsViewport =
      this.initialCanvasHeight +
        layoutData.rects.previewFooterRect.height +
        TOP_OFFSET >
      window.innerHeight;

    if (contentExceedsViewport) {
      this.manageShrinkingColumn(layoutData);
    } else {
      this.manageFullStickyColumn(layoutData);
    }
  }

  private manageAdvancedControlsLayout(layoutData: LayoutData): void {
    const { elements, rects } = layoutData;
    const {
      advancedControlsContainer,
      activeForm,
      canvasContainer,
      qrPreviewColumnFooter,
      qrPreviewColumn,
    } = elements;
    const currentMode = this.uiManager.getCurrentMode();

    if (
      advancedControlsContainer.classList.contains('hidden') ||
      this.advancedControlsMoved[currentMode]
    ) {
      return;
    }

    const previewContentHeight =
      canvasContainer.offsetHeight + qrPreviewColumnFooter.offsetHeight;
    const formHeight = activeForm?.offsetHeight || 0;
    const advancedControlsBottom = rects.advancedControlsRect.bottom;

    if (
      formHeight < previewContentHeight &&
      advancedControlsBottom > window.innerHeight
    ) {
      advancedControlsContainer.classList.remove('both-columns');
      qrPreviewColumn.classList.add('both-rows');
      this.advancedControlsMoved[currentMode] = true;
    }
  }

  private manageShrinkingColumn(layoutData: LayoutData): void {
    this.ensureOriginalDomStructure(layoutData);
    this.unstickFullColumn(layoutData);
    // Corrected order of operations
    this.handleStickyFooter(layoutData);
    this.updateShrinkingColumnLayout(layoutData);
    this.resizeQrCodeForShrinkingColumn(layoutData);
  }

  private manageFullStickyColumn(layoutData: LayoutData): void {
    this.handleStickyFullColumn(layoutData);
    this.updateFullColumnLayout(layoutData);
  }

  private resetDesktopStyles(): void {
    const {
      canvasContainer,
      qrCanvasPlaceholder,
      qrPreviewColumnFooter,
      qrStickyContainer,
    } = dom;
    if (canvasContainer) {
      canvasContainer.classList.remove('is-sticky');
      Object.assign(canvasContainer.style, {
        width: '',
        transform: '',
        transformOrigin: '',
      });
    }
    if (qrCanvasPlaceholder) {
      qrCanvasPlaceholder.style.height = '0px';
    }
    if (qrPreviewColumnFooter) {
      qrPreviewColumnFooter.classList.remove('sticky-footer');
      qrPreviewColumnFooter.style.bottom = '';
      qrPreviewColumnFooter.style.width = ''; // Reset width as well
    }
    if (qrStickyContainer) {
      qrStickyContainer.classList.remove('is-full-sticky');
    }
  }

  private resetMobileStyles(): void {
    const { canvasContainer } = dom;
    if (canvasContainer) {
      canvasContainer.classList.remove('is-mobile-transformed');
      canvasContainer.style.transform = '';
    }
  }

  private applyMobileStickyEffect(): void {
    const { canvasContainer } = dom;
    if (!canvasContainer) return;

    if (this.mobileCanvasTop === null) {
      this.calculateMobileCanvasTop();
    }

    const scrollThreshold = this.mobileCanvasTop!;
    const currentScroll = window.scrollY;

    if (currentScroll > scrollThreshold) {
      canvasContainer.classList.add('is-mobile-transformed');
      const { transform } = this.calculateMobileTransform(
        currentScroll,
        scrollThreshold
      );
      canvasContainer.style.transform = transform;
    } else {
      canvasContainer.classList.remove('is-mobile-transformed');
      canvasContainer.style.transform = 'translateX(0) scale(1)';
    }
  }

  private calculateMobileCanvasTop(): void {
    const { canvasContainer } = dom;
    const header = document.querySelector('.header-section') as HTMLElement;
    if (header) {
      const headerRect = header.getBoundingClientRect();
      const headerStyle = window.getComputedStyle(header);
      const headerMarginBottom = parseFloat(headerStyle.marginBottom);
      this.mobileCanvasTop =
        headerRect.bottom + headerMarginBottom + window.scrollY;
    } else if (canvasContainer) {
      this.mobileCanvasTop =
        canvasContainer.getBoundingClientRect().top + window.scrollY;
    }
    this.initialCanvasWidth =
      canvasContainer?.querySelector('canvas')?.offsetWidth ||
      this.initialCanvasHeight;
  }

  private calculateMobileTransform(
    currentScroll: number,
    scrollThreshold: number
  ): { transform: string } {
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

    return { transform: `translateX(${translateX}px) scale(${scaleFactor})` };
  }

  private updateFullColumnLayout(data: LayoutData): void {
    const { advancedControlsContainer, qrPreviewColumn } = data.elements;
    const currentMode = this.uiManager.getCurrentMode();

    if (this.advancedControlsMoved[currentMode]) {
      return;
    }

    if (advancedControlsContainer.classList.contains('hidden')) {
      advancedControlsContainer.classList.add('both-columns');
      qrPreviewColumn.classList.remove('both-rows');
      return;
    }

    const currentScrollY = window.scrollY;
    const relativeStickyTop = this.stickyContainerTop - currentScrollY;

    if (relativeStickyTop <= TOP_OFFSET) {
      advancedControlsContainer.classList.remove('both-columns');
      qrPreviewColumn.classList.add('both-rows');
    } else {
      advancedControlsContainer.classList.add('both-columns');
      qrPreviewColumn.classList.remove('both-rows');
    }
  }

  private handleStickyFullColumn(data: LayoutData): void {
    const {
      qrStickyContainer,
      qrPreviewColumnFooter,
      canvasContainer,
      formColumn,
      qrPreviewColumn,
    } = data.elements;
    const { previewFooterRect } = data.rects;

    if (!qrStickyContainer.contains(qrPreviewColumnFooter)) {
      qrStickyContainer.appendChild(qrPreviewColumnFooter);
    }
    qrStickyContainer.classList.add('is-full-sticky');

    this.resetShrinkingColumnStyles(data);

    const fullStickyElementHeight =
      this.initialCanvasHeight + previewFooterRect.height;
    const colHeightDiff = formColumn.offsetHeight - fullStickyElementHeight;
    const previewColumnTop = qrPreviewColumn.getBoundingClientRect().top;
    let bottomIntrusion = colHeightDiff + previewColumnTop - TOP_OFFSET;
    bottomIntrusion = bottomIntrusion < 0 ? -bottomIntrusion : 0;

    if (bottomIntrusion > 0) {
      const availableQrHeight =
        qrPreviewColumnFooter.getBoundingClientRect().top - TOP_OFFSET;
      const minHeight = window.innerHeight * 0.33;
      const clampedHeight = Math.max(minHeight, availableQrHeight);
      const finalHeight = Math.min(clampedHeight, this.initialCanvasHeight);
      let scaleFactor = finalHeight / this.initialCanvasHeight;
      scaleFactor = Math.max(0, Math.min(1, scaleFactor));
      canvasContainer.style.transformOrigin = 'bottom center';
      canvasContainer.style.transform = `scale(${scaleFactor})`;
    } else {
      canvasContainer.style.transform = 'scale(1)';
      canvasContainer.style.transformOrigin = '';
    }
  }

  private resetShrinkingColumnStyles(data: LayoutData): void {
    const { canvasContainer, qrCanvasPlaceholder, qrPreviewColumnFooter } =
      data.elements;
    canvasContainer.classList.remove('is-sticky');
    qrCanvasPlaceholder.style.height = '0px';
    Object.assign(canvasContainer.style, {
      transform: 'scale(1)',
      width: '',
      transformOrigin: '',
    });
    qrPreviewColumnFooter.classList.remove('sticky-footer');
    qrPreviewColumnFooter.style.bottom = '';
  }

  private ensureOriginalDomStructure(data: LayoutData): void {
    const { qrPreviewColumn, qrStickyContainer, qrPreviewColumnFooter } =
      data.elements;
    if (qrStickyContainer.contains(qrPreviewColumnFooter)) {
      qrPreviewColumn.appendChild(qrPreviewColumnFooter);
    }
  }

  private unstickFullColumn(data: LayoutData): void {
    data.elements.qrStickyContainer?.classList.remove('is-full-sticky');
  }

  private getLayoutData(): LayoutData | null {
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

  private resizeQrCodeForShrinkingColumn(data: LayoutData): void {
    const { elements, rects } = data;
    const { canvasContainer, qrCanvasPlaceholder, qrPreviewColumnFooter } =
      elements;
    const currentScrollY = window.scrollY;
    const relativeStickyTop = this.stickyContainerTop - currentScrollY;
    const shouldBeSticky = relativeStickyTop <= TOP_OFFSET;

    if (shouldBeSticky) {
      if (!canvasContainer.classList.contains('is-sticky')) {
        canvasContainer.classList.add('is-sticky');
        qrCanvasPlaceholder.style.height = `${this.initialCanvasHeight}px`;
      }

      const scrollPast = TOP_OFFSET - relativeStickyTop;
      const shrinkingHeight = this.initialCanvasHeight - scrollPast;
      const minHeight = window.innerHeight * 0.33;

      // *** FINAL FIX: Get the live position of the footer. ***
      const currentFooterRect = qrPreviewColumnFooter.getBoundingClientRect();

      // The available height is the distance from the fixed sticky top offset
      // to the current, live position of the footer's top edge.
      const availableHeight = currentFooterRect.top - TOP_OFFSET;

      // The target height is the smaller of the two constraints: the height
      // determined by scrolling and the actual available space.

      let targetHeight =
        shrinkingHeight > availableHeight ? shrinkingHeight : availableHeight;

      // Ensure the QR code doesn't shrink below the minimum allowed height.
      targetHeight = Math.max(targetHeight, minHeight);

      let scaleFactor = targetHeight / this.initialCanvasHeight;
      scaleFactor = Math.min(1, Math.max(0, scaleFactor)); // Clamp between 0 and 1

      canvasContainer.style.transform = `scale(${scaleFactor})`;
      canvasContainer.style.width = `${rects.previewColumnRect.width}px`;
    } else {
      if (canvasContainer.classList.contains('is-sticky')) {
        canvasContainer.classList.remove('is-sticky');
        qrCanvasPlaceholder.style.height = '0px';
        canvasContainer.style.transform = 'scale(1)';
        canvasContainer.style.width = '';
      }
    }
  }

  private updateShrinkingColumnLayout(data: LayoutData): void {
    const { elements, rects } = data;
    const {
      advancedControlsContainer,
      qrPreviewColumn,
      qrPreviewColumnFooter,
    } = elements;
    const isScrollingDown = window.scrollY > this.lastScrollY;
    const currentMode = this.uiManager.getCurrentMode();

    if (this.advancedControlsMoved[currentMode]) {
      return;
    }

    const isFooterSticky =
      qrPreviewColumnFooter.classList.contains('sticky-footer');

    if (
      (isScrollingDown &&
        rects.qrcodeTextContainerRect.bottom >= rects.formColumnRect.bottom) ||
      isFooterSticky
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
    const { qrPreviewColumnFooter } = elements;

    const footerShouldStick = this.shouldFooterStick(rects);

    if (footerShouldStick) {
      const { bottom, width } = this.calculateFooterStickyPosition(rects);
      qrPreviewColumnFooter.classList.add('sticky-footer');
      qrPreviewColumnFooter.style.bottom = `${bottom}px`;
      qrPreviewColumnFooter.style.width = `${width}px`;
    } else {
      qrPreviewColumnFooter.classList.remove('sticky-footer');
      qrPreviewColumnFooter.style.bottom = '';
      qrPreviewColumnFooter.style.width = '';
    }
  }

  private shouldFooterStick(rects: LayoutData['rects']): boolean {
    const contentExceedsViewport =
      this.initialCanvasHeight + rects.previewFooterRect.height >
      window.innerHeight;
    const calculatedPreviewFooterRectTop =
      rects.previewColumnRect.top + this.initialCanvasHeight;
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

    return (
      contentExceedsViewport &&
      previewColumnSmaller &&
      previewFooterBottomOffset < -32
    );
  }

  private calculateFooterStickyPosition(rects: LayoutData['rects']): {
    bottom: number;
    width: number;
  } {
    const contentWrapperBottomOffset =
      rects.contentWrapperRect.bottom < window.innerHeight
        ? window.innerHeight - rects.contentWrapperRect.bottom
        : 0;
    const bottom = contentWrapperBottomOffset + 32;
    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize
    );
    const remInPx = 2.75 * rootFontSize;
    const containerWidth = rects.contentWrapperRect.width;
    const width = containerWidth / 2 - remInPx;
    return { bottom, width };
  }

  private setupMobileDOM(): void {
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
    if (qrCanvasPlaceholder) qrCanvasPlaceholder.style.display = 'none';
  }

  private setupDesktopDOM(): void {
    const { qrStickyContainer, canvasContainer, qrCanvasPlaceholder } = dom;
    if (
      qrStickyContainer &&
      canvasContainer &&
      !qrStickyContainer.contains(canvasContainer)
    ) {
      qrStickyContainer.prepend(canvasContainer);
    }
    if (qrCanvasPlaceholder) qrCanvasPlaceholder.style.display = '';
  }

  private setupEventListeners(): void {
    window.addEventListener('scroll', () => this.handleStickyBehavior(false));
    window.addEventListener('resize', () => this.handleStickyBehavior(true));
  }
}

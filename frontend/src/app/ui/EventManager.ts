// standearth/vcard-qr/vcard-qr-phone-settings/frontend/src/app/ui/EventManager.ts

import { dom } from '../../config/dom';
import { App } from '../App';
import { UIManager } from '../UIManager';
import {
  generateFilename,
  calculateAndApplyOptimalQrCodeSize,
} from '../../utils/helpers';
import { stateService } from '../StateService';
import {
  Mode,
  MODES,
  DEFAULT_ADVANCED_OPTIONS,
  TAB_SPECIFIC_DEFAULTS,
  TabState,
  DESKTOP_BREAKPOINT_PX,
} from '../../config/constants';
import { formatPhoneNumber } from '@vcard-qr/shared-utils';

export class EventManager {
  private app: App;
  private uiManager: UIManager;
  private isOptimizing = false;
  private previousWidth = 0;
  private qrUpdateTimeout?: number;

  constructor(app: App, uiManager: UIManager) {
    this.app = app;
    this.uiManager = uiManager;
    this.setupEventListeners();
  }

  public handleStateUpdate = async (
    activeElement?: HTMLElement
  ): Promise<void> => {
    // Clear any pending debounced update, as we are performing a full update now.
    clearTimeout(this.qrUpdateTimeout);

    const currentMode = this.uiManager.getCurrentMode();
    const newValues = this.uiManager.getFormControlValues();

    stateService.updateState(currentMode, newValues, activeElement);

    await this.app.updateQRCode();
    this.uiManager
      .getUrlHandler()
      .updateUrlFromState(stateService.getState(currentMode)!);
  };

  /**
   * Handles user input by updating the UI immediately but debouncing the
   * expensive QR code regeneration.
   */
  private handleFormInput = (event?: Event): void => {
    const activeElement = event?.target as HTMLElement | undefined;
    const currentMode = this.uiManager.getCurrentMode();
    const newValues = this.uiManager.getFormControlValues();

    // Update state and URL immediately for responsive feedback.
    stateService.updateState(currentMode, newValues, activeElement);
    this.uiManager
      .getUrlHandler()
      .updateUrlFromState(stateService.getState(currentMode)!);

    // Trigger a fast, live preview render.
    this.app.updateQRCode(true);

    // Debounce the final, high-quality render.
    clearTimeout(this.qrUpdateTimeout);
    this.qrUpdateTimeout = window.setTimeout(() => {
      this.app.updateQRCode(false);
    }, 300); // 300ms delay
  };

  private handlePhoneBlur = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    const currentValue = input.value;

    if (currentValue) {
      const formattedValue = formatPhoneNumber(currentValue, 'CUSTOM');
      input.value = formattedValue;
    }

    this.handleFormInput(event);
  };

  /**
   * Handles the click event on the QR code, scrolling the view back to its natural starting position.
   */
  private _handleQrCodeClick = (): void => {
    const header = document.querySelector('.header-section') as HTMLElement;
    if (!header) return;

    const headerRect = header.getBoundingClientRect();
    const headerStyle = window.getComputedStyle(header);
    const headerMarginBottom = parseFloat(headerStyle.marginBottom);

    let targetScrollY = headerRect.bottom + window.scrollY + headerMarginBottom;

    // On desktop, account for the 0.5rem (8px) sticky offset.
    if (window.innerWidth >= DESKTOP_BREAKPOINT_PX) {
      targetScrollY -= 8;
    }

    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth',
    });
  };

  /**
   * A custom smooth scroll function that recalculates the target position
   * during the animation, accommodating for layout reflows.
   * @param getTargetY A function that returns the target Y scroll position.
   * @param onComplete An optional callback to run when the scroll is finished.
   */
  private smoothScrollWithReflow(
    getTargetY: () => number,
    onComplete?: () => void
  ) {
    const startY = window.scrollY;
    let targetY = getTargetY();
    const startTime = performance.now();
    const duration = 500; // Animation duration in ms

    const easeInOutQuad = (t: number) =>
      t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const scrollStep = (currentTime: number) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);

      // Recalculate targetY in each step
      targetY = getTargetY();

      const newY = startY + (targetY - startY) * easeInOutQuad(progress);

      window.scrollTo(0, newY);

      if (progress < 1) {
        requestAnimationFrame(scrollStep);
      } else {
        // One final scroll to ensure it's at the precise end position
        window.scrollTo(0, getTargetY());
        if (onComplete) {
          onComplete();
        }
      }
    };

    requestAnimationFrame(scrollStep);
  }

  private setupEventListeners(): void {
    this.previousWidth = parseInt(dom.advancedControls.width.value);
    window.addEventListener('hashchange', this.app.handleRouteChange);

    Object.values(dom.formContainers).forEach((form) => {
      form.addEventListener('submit', (event) => event.preventDefault());
    });

    Object.values(dom.tabLinks).forEach((tab) => {
      tab.addEventListener('click', () =>
        this.uiManager.getTabManager().switchTab(tab.dataset.tab as Mode)
      );
    });

    const phoneTextFields = [
      dom.formFields.workPhone,
      dom.formFields.cellPhone,
      dom.formFields.whatsapp,
      dom.formFields.officePhoneInput,
    ];

    phoneTextFields.forEach((field) => {
      field.addEventListener('input', (event) => this.handleFormInput(event));
      field.addEventListener('blur', (event) => this.handlePhoneBlur(event));
    });

    dom.formFields.officePhone.addEventListener('change', (event) =>
      this.handleFormInput(event)
    );

    dom.formFields.website.addEventListener('input', (event) => {
      this.app.handleWebsiteChange();
      this.handleFormInput(event);
    });

    Object.values(dom.formFields).forEach((field) => {
      if (
        field instanceof HTMLElement &&
        !phoneTextFields.includes(field as any) &&
        field.id !== 'office_phone' &&
        field.id !== 'website'
      ) {
        field.addEventListener('input', (event) => this.handleFormInput(event));
      }
    });

    dom.logoSelectionContainer.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest('.logo-thumbnail');
      if (button) {
        const logoUrl = button.getAttribute('data-logo-url');
        if (logoUrl) {
          dom.advancedControls.logoUrl.value = logoUrl;
          this.handleFormInput(event);
        }
      }
    });

    this.setupAdvancedControlsListeners();
    this.setupButtonEventListeners();
  }

  private setupButtonEventListeners(): void {
    dom.canvasContainer?.addEventListener('click', this._handleQrCodeClick);

    dom.buttons.downloadPng.addEventListener('click', () =>
      this.app.getQrCode().download({
        name: generateFilename(this.uiManager.getCurrentMode()),
        extension: 'png',
      })
    );
    dom.buttons.downloadJpg.addEventListener('click', () =>
      this.app.getQrCode().download({
        name: generateFilename(this.uiManager.getCurrentMode()),
        extension: 'jpeg',
      })
    );
    dom.buttons.downloadSvg.addEventListener('click', () =>
      this.app.getQrCode().download({
        name: generateFilename(this.uiManager.getCurrentMode()),
        extension: 'svg',
      })
    );

    dom.buttons.downloadVCard.addEventListener('click', () => {
      const blob = new Blob([this.app.getQRCodeData()], {
        type: 'text/vcard',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generateFilename(this.uiManager.getCurrentMode())}.vcf`;
      a.click();
      URL.revokeObjectURL(url);
    });

    dom.buttons.toggleAdvanced.addEventListener('click', () => {
      const currentState = this.uiManager.getTabState();
      if (currentState) {
        const newVisibility = !currentState.isAdvancedControlsVisible;

        Object.values(MODES).forEach((mode) => {
          stateService.updateState(mode, {
            isAdvancedControlsVisible: newVisibility,
          });
        });

        this.uiManager.renderUIFromState(
          stateService.getState(this.uiManager.getCurrentMode())!
        );

        setTimeout(() => {
          this.uiManager.getStickyManager().handleStickyBehavior();

          if (newVisibility) {
            const getTargetScrollY = () => {
              const isMobile = window.innerWidth < DESKTOP_BREAKPOINT_PX;
              const advancedControlsEl = dom.advancedControls.container;
              if (isMobile) {
                return advancedControlsEl.offsetTop - window.innerHeight / 3;
              } else {
                const stickyHeaderOffset = 8; // As defined in StickyManager
                return advancedControlsEl.offsetTop - stickyHeaderOffset;
              }
            };

            this.smoothScrollWithReflow(getTargetScrollY);
          }
        }, 100); // A minimal delay for the DOM to update
      }
    });

    dom.buttons.resetStyles.addEventListener('click', () => {
      const currentMode = this.uiManager.getCurrentMode();
      const currentState = this.uiManager.getTabState();
      if (currentState) {
        const tabDefaults = TAB_SPECIFIC_DEFAULTS[currentMode] || {};

        // Start with a clean slate of defaults by applying them in order
        const newTabState: TabState = {
          ...currentState,
          ...DEFAULT_ADVANCED_OPTIONS, // Base defaults
          ...tabDefaults, // Tab-specific overrides
          isAdvancedControlsVisible: currentState.isAdvancedControlsVisible,
          isModalVisible: false,
        };

        // Deep-merge all nested option objects to ensure they are fully populated,
        // preventing partial overrides from breaking the state.
        newTabState.qrOptions = {
          ...DEFAULT_ADVANCED_OPTIONS.qrOptions,
          ...(tabDefaults.qrOptions || {}),
        };
        newTabState.imageOptions = {
          ...DEFAULT_ADVANCED_OPTIONS.imageOptions,
          ...(tabDefaults.imageOptions || {}),
        };
        newTabState.dotsOptions = {
          ...DEFAULT_ADVANCED_OPTIONS.dotsOptions,
          ...(tabDefaults.dotsOptions || {}),
        };
        newTabState.cornersSquareOptions = {
          ...DEFAULT_ADVANCED_OPTIONS.cornersSquareOptions,
          ...(tabDefaults.cornersSquareOptions || {}),
        };
        newTabState.cornersDotOptions = {
          ...DEFAULT_ADVANCED_OPTIONS.cornersDotOptions,
          ...(tabDefaults.cornersDotOptions || {}),
        };
        newTabState.backgroundOptions = {
          ...DEFAULT_ADVANCED_OPTIONS.backgroundOptions,
          ...(tabDefaults.backgroundOptions || {}),
        };

        this.uiManager.getFormManager().setFormControlValues(newTabState);
        this.handleStateUpdate();
      }
    });

    dom.buttons.sendToPhone.addEventListener('click', () => {
      const state = this.uiManager.getTabState();
      if (state) {
        stateService.updateState(this.uiManager.getCurrentMode(), {
          isModalVisible: true,
        });
        let finalUrl = window.location.href;
        finalUrl += finalUrl.includes('?') ? '&download=png' : '?download=png';
        this.app.getModalQrCode().update({ data: finalUrl });
      }
    });

    dom.modal.closeButton.addEventListener('click', () => {
      stateService.updateState(this.uiManager.getCurrentMode(), {
        isModalVisible: false,
      });
    });

    dom.modal.overlay.addEventListener('click', (event) => {
      if (event.target === dom.modal.overlay) {
        stateService.updateState(this.uiManager.getCurrentMode(), {
          isModalVisible: false,
        });
      }
    });
  }

  private handleOptimization = async (increment = 0): Promise<void> => {
    if (this.isOptimizing) return;
    this.isOptimizing = true;

    try {
      calculateAndApplyOptimalQrCodeSize(
        this.app.getQrCode(),
        this.uiManager,
        increment
      );
      this.previousWidth = parseInt(dom.advancedControls.width.value);
      await this.handleStateUpdate();
    } finally {
      this.isOptimizing = false;
    }
  };

  private setupAdvancedControlsListeners(): void {
    const { advancedControls } = dom;

    Object.entries(advancedControls).forEach(([key, field]) => {
      if (field instanceof HTMLElement) {
        let eventType = 'input';
        if (
          field instanceof HTMLInputElement &&
          (field.type === 'checkbox' || field.type === 'radio')
        ) {
          eventType = 'change';
        } else if (field instanceof HTMLSelectElement) {
          eventType = 'change';
        }

        if (
          key === 'width' ||
          key === 'height' ||
          key === 'optimizeSize' ||
          key === 'roundSize' ||
          key === 'margin'
        ) {
          field.addEventListener(eventType, async (event) => {
            const target = event.target as HTMLInputElement | HTMLSelectElement;
            const isOptimized = advancedControls.optimizeSize.checked;

            switch (target.id) {
              case 'form-width':
              case 'form-height':
                if (isOptimized) {
                  const newValue =
                    parseInt((target as HTMLInputElement).value) || 0;
                  const increment = newValue > this.previousWidth ? 1 : -1;
                  await this.handleOptimization(increment);
                } else {
                  this.handleFormInput(event);
                }
                break;
              case 'form-optimize-size':
                if (advancedControls.optimizeSize.checked) {
                  advancedControls.roundSize.checked = true;
                }
                await this.handleOptimization(0);
                break;
              case 'form-round-size':
                if (!advancedControls.roundSize.checked) {
                  advancedControls.optimizeSize.checked = false;
                }
                this.handleFormInput(event);
                break;
              case 'form-margin':
                if (isOptimized) {
                  await this.handleOptimization(0);
                } else {
                  this.handleFormInput(event);
                }
                break;
              default:
                this.handleFormInput(event);
                break;
            }
          });
        } else {
          field.addEventListener(eventType, (event) =>
            this.handleFormInput(event)
          );
        }
      }
    });
  }
}

// src/app/ui/EventManager.ts

import { dom } from '../../config/dom';
import { App } from '../App';
import { UIManager } from '../UIManager';
import {
  generateFilename,
  calculateAndApplyOptimalQrCodeSize,
  generateQRCodeData,
} from '../../utils/helpers';
import { stateService } from '../StateService';
import {
  Mode,
  MODES,
  DEFAULT_ADVANCED_OPTIONS,
  TAB_SPECIFIC_DEFAULTS,
  TabState,
} from '../../config/constants';
import { formatPhoneNumber } from '@vcard-qr/shared-utils';

export class EventManager {
  private app: App;
  private uiManager: UIManager;
  private isOptimizing = false;
  private previousWidth = 0;

  constructor(app: App, uiManager: UIManager) {
    this.app = app;
    this.uiManager = uiManager;
    this.setupEventListeners();
  }

  private handleStateUpdate = async (): Promise<void> => {
    const currentMode = this.uiManager.getCurrentMode();
    const newValues = this.uiManager.getFormControlValues();
    stateService.updateState(currentMode, newValues);

    const newQrCodeContent = generateQRCodeData(
      stateService.getState(currentMode)!,
      currentMode
    );

    const isQrCodeValid = await this.app.updateQRCode();

    stateService.updateState(currentMode, {
      qrCodeContent: newQrCodeContent,
      isQrCodeValid,
    });

    this.uiManager
      .getUrlHandler()
      .updateUrlFromState(stateService.getState(currentMode)!);
  };

  private handlePhoneBlur = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    const currentValue = input.value;
    if (currentValue) {
      const formattedValue = formatPhoneNumber(currentValue, 'CUSTOM');
      if (currentValue !== formattedValue) {
        input.value = formattedValue;
        this.handleStateUpdate();
      }
    }
  };

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

    // Add specific listeners for freeform phone fields
    const phoneFields = [dom.formFields.workPhone, dom.formFields.cellPhone];

    phoneFields.forEach((field) => {
      field.addEventListener('input', this.handleStateUpdate);
      field.addEventListener('blur', this.handlePhoneBlur);
    });

    // Handle other form fields
    Object.values(dom.formFields).forEach((field) => {
      if (field instanceof HTMLElement && !phoneFields.includes(field as any)) {
        field.addEventListener('input', this.handleStateUpdate);
      }
    });

    this.setupAdvancedControlsListeners();
    this.setupButtonEventListeners();
  }

  private setupButtonEventListeners(): void {
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
      const blob = new Blob([this.app.getQRCodeData()], { type: 'text/vcard' });
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

        // This is a UI-only change, so it doesn't need the full handleStateUpdate
        Object.values(MODES).forEach((mode) => {
          stateService.updateState(mode, {
            isAdvancedControlsVisible: newVisibility,
          });
        });

        // Manually trigger the render to reflect the visibility change
        this.uiManager.renderUIFromState(
          stateService.getState(this.uiManager.getCurrentMode())!
        );

        // Adjust sticky behavior after the DOM has been updated
        setTimeout(() => {
          this.uiManager.getStickyManager().handleStickyBehavior();
        }, 0);
      }
    });

    dom.buttons.resetStyles.addEventListener('click', () => {
      const currentMode = this.uiManager.getCurrentMode();
      const currentState = this.uiManager.getTabState();
      if (currentState) {
        const newTabState: TabState = {
          ...currentState,
          ...DEFAULT_ADVANCED_OPTIONS,
          ...(TAB_SPECIFIC_DEFAULTS[currentMode] || {}),
          isAdvancedControlsVisible: currentState.isAdvancedControlsVisible,
          isModalVisible: false,
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

        // Re-introduce special handling for the optimization controls
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
                  await this.handleStateUpdate();
                }
                break;
              case 'form-optimize-size':
                if (advancedControls.optimizeSize.checked) {
                  advancedControls.roundSize.checked = true;
                }
                await this.handleStateUpdate();
                await this.handleOptimization(0);
                break;
              case 'form-round-size':
                if (!advancedControls.roundSize.checked) {
                  advancedControls.optimizeSize.checked = false;
                }
                await this.handleStateUpdate();
                break;
              case 'form-margin':
                await this.handleStateUpdate();
                if (isOptimized) {
                  await this.handleOptimization(0);
                }
                break;
              default:
                await this.handleStateUpdate();
                break;
            }
          });
        } else {
          // All other controls use the standard handler
          field.addEventListener(eventType, this.handleStateUpdate);
        }
      }
    });
  }
}

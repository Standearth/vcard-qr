// src/app/ui/EventManager.ts

import { dom } from '../../config/dom';
import { App } from '../App';
import { UIManager } from '../UIManager';
import {
  generateFilename,
  calculateAndApplyOptimalQrCodeSize,
  generateQRCodeData, // Import the function here
} from '../../utils/helpers';
import { stateService } from '../StateService';
import {
  Mode,
  MODES,
  DEFAULT_ADVANCED_OPTIONS,
  TAB_SPECIFIC_DEFAULTS,
  TabState,
} from '../../config/constants';

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

    // Create a temporary state object to pass to the data generator
    const currentState = stateService.getState(currentMode) || {};
    const tempStateForGeneration: TabState = { ...currentState, ...newValues };
    const newQrCodeContent = generateQRCodeData(
      tempStateForGeneration,
      currentMode
    );

    // Now, update the state with all new information at once
    stateService.updateState(currentMode, {
      ...newValues,
      qrCodeContent: newQrCodeContent,
    });

    // The state update above will trigger the UI render. Now, update the QR code image.
    await this.app.updateQRCode();

    this.uiManager
      .getUrlHandler()
      .updateUrlFromState(stateService.getState(currentMode)!);
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

    Object.values(dom.formFields).forEach((field) => {
      if (field instanceof HTMLElement) {
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

        stateService.updateState(currentMode, newTabState);
        dom.advancedControls.imageFile.value = '';
        this.uiManager.getUrlHandler().updateUrlFromState(newTabState);
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

    Object.values(advancedControls).forEach((field) => {
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

        field.addEventListener(eventType, async (event) => {
          const target = event.target as HTMLInputElement | HTMLSelectElement;
          const isOptimized = advancedControls.optimizeSize.checked;

          switch (target.id) {
            case 'form-width':
            case 'form-height':
              if (isOptimized) {
                const newValue =
                  parseInt((target as HTMLInputElement).value) || 0;

                const qr = (this.app.getQrCode() as any)._qr;
                if (qr) {
                  const moduleCount = qr.getModuleCount();
                  const margin = this.uiManager.getTabState()?.margin ?? 0;
                  const isPerfectlySized =
                    moduleCount > 0 &&
                    (newValue - margin * 2) % moduleCount === 0;

                  if (isPerfectlySized) {
                    this.previousWidth = newValue;
                    return;
                  }
                }

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
      }
    });
  }
}

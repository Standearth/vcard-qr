// src/app/ui/EventManager.ts

import { dom } from '../../config/dom';
import { App } from '../App';
import { UIManager } from '../UIManager';
import {
  generateFilename,
  calculateAndApplyOptimalQrCodeSize,
} from '../../utils/helpers';
import { updateTabState } from '../state';
import {
  Mode,
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

  private handleFormInputChange = (): void => {
    updateTabState(
      this.uiManager.getCurrentMode(),
      this.uiManager.getFormControlValues()
    );
    this.app.updateQRCode();
  };

  private setupEventListeners(): void {
    this.previousWidth = parseInt(dom.advancedControls.width.value);
    window.addEventListener('hashchange', this.app.handleRouteChange);

    // Prevent default form submission which causes a page reload
    Object.values(dom.formContainers).forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
      });
    });

    Object.values(dom.tabLinks).forEach((tab) => {
      tab.addEventListener('click', () =>
        this.uiManager.getTabManager().switchTab(tab.dataset.tab as Mode)
      );
    });

    Object.values(dom.formFields).forEach((field) => {
      if (field instanceof HTMLElement) {
        field.addEventListener('input', this.handleFormInputChange);
      }
    });

    this.setupAdvancedControlsListeners();

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
      const isHidden =
        dom.advancedControls.container.classList.toggle('hidden');
      dom.toggleAdvancedText.textContent = isHidden
        ? 'Show Advanced Controls'
        : 'Hide Advanced Controls';

      setTimeout(() => {
        this.uiManager.getStickyManager().handleStickyBehavior();
      }, 0);
    });

    dom.buttons.resetStyles.addEventListener('click', () => {
      const newTabState = {
        ...DEFAULT_ADVANCED_OPTIONS,
        ...(TAB_SPECIFIC_DEFAULTS[this.uiManager.getCurrentMode()] || {}),
      } as TabState;
      updateTabState(this.uiManager.getCurrentMode(), newTabState);
      this.uiManager.setFormControlValues(newTabState);
      dom.advancedControls.imageFile.value = '';
      this.app.updateQRCode();
    });

    dom.buttons.sendToPhone.addEventListener('click', () => {
      let finalUrl = window.location.href;
      finalUrl += finalUrl.includes('?') ? '&download=png' : '?download=png';
      this.app.getModalQrCode().update({ data: finalUrl });
      dom.modal.overlay.classList.remove('hidden');
    });

    dom.modal.closeButton.addEventListener('click', () =>
      dom.modal.overlay.classList.add('hidden')
    );
    dom.modal.overlay.addEventListener('click', (event) => {
      if (event.target === dom.modal.overlay)
        dom.modal.overlay.classList.add('hidden');
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
    } finally {
      this.isOptimizing = false;
    }
  };

  private setupAdvancedControlsListeners(): void {
    const { advancedControls } = dom;

    const genericUpdate = () => {
      if (this.isOptimizing) return;
      this.previousWidth = parseInt(advancedControls.width.value) || 0;
      updateTabState(
        this.uiManager.getCurrentMode(),
        this.uiManager.getFormControlValues()
      );
      this.app.updateQRCode();
    };

    const isPerfectlySized = (size: number): boolean => {
      const qr = (this.app.getQrCode() as any)._qr;
      if (!qr) return true; // Failsafe
      const moduleCount = qr.getModuleCount();
      const state = this.uiManager.getTabState();
      const margin = state?.margin ?? 0;
      if (moduleCount === 0) return true; // Failsafe

      return (size - margin * 2) % moduleCount === 0;
    };

    Object.values(advancedControls).forEach((field) => {
      if (field instanceof HTMLElement) {
        field.addEventListener('input', async (event) => {
          const target = event.target as HTMLInputElement | HTMLSelectElement;
          const isOptimized = advancedControls.optimizeSize.checked;

          // --- Main Logic Switch ---
          switch (target.id) {
            case 'form-optimize-size':
              if (advancedControls.optimizeSize.checked) {
                this.isOptimizing = true;
                advancedControls.roundSize.checked = true;
                updateTabState(
                  this.uiManager.getCurrentMode(),
                  this.uiManager.getFormControlValues()
                );
                await this.app.updateQRCode();
                this.isOptimizing = false;
                await this.handleOptimization(0);
              } else {
                genericUpdate();
              }
              break;

            case 'form-round-size':
              if (!advancedControls.roundSize.checked) {
                advancedControls.optimizeSize.checked = false;
              }
              genericUpdate();
              break;

            case 'form-qr-type-number':
              if (isOptimized) {
                this.isOptimizing = true;
                updateTabState(
                  this.uiManager.getCurrentMode(),
                  this.uiManager.getFormControlValues()
                );
                await this.app.updateQRCode();
                this.isOptimizing = false;
                await this.handleOptimization(0);
              } else {
                advancedControls.imageFile.value = '';
                genericUpdate();
              }
              break;

            case 'form-width':
            case 'form-height':
              if (isOptimized) {
                const newValue = parseInt(target.value) || 0;
                if (isPerfectlySized(newValue)) {
                  this.previousWidth = newValue;
                  return;
                }
                const increment = newValue > this.previousWidth ? 1 : -1;
                await this.handleOptimization(increment);
              } else {
                genericUpdate();
              }
              break;

            case 'form-margin':
              if (isOptimized) {
                updateTabState(
                  this.uiManager.getCurrentMode(),
                  this.uiManager.getFormControlValues()
                );
                await this.handleOptimization(0);
              } else {
                genericUpdate();
              }
              break;

            default:
              genericUpdate();
              break;
          }
        });
      }
    });
  }
}

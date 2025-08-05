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

  private setupEventListeners(): void {
    this.previousWidth = parseInt(dom.advancedControls.width.value);
    window.addEventListener('hashchange', this.app.handleRouteChange);

    Object.values(dom.tabLinks).forEach((tab) => {
      tab.addEventListener('click', () =>
        this.uiManager.getTabManager().switchTab(tab.dataset.tab as Mode)
      );
    });

    Object.values(dom.formFields).forEach((field) => {
      if (field instanceof HTMLElement) {
        field.addEventListener('input', this.app.updateQRCode);
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

  /**
   * REFACTOR: All advanced controls are now handled by a single, unified event listener.
   * This ensures that every change correctly triggers either the optimization logic
   * or a generic state/URL update, preventing synchronization issues.
   */
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

    Object.values(advancedControls).forEach((field) => {
      if (field instanceof HTMLElement) {
        field.addEventListener('input', async (event) => {
          const target = event.target as HTMLInputElement | HTMLSelectElement;
          const isOptimized = advancedControls.optimizeSize.checked;

          // --- Main Logic Switch ---
          switch (target.id) {
            // Activation for the main optimization checkbox
            case 'form-optimize-size':
              if (advancedControls.optimizeSize.checked) {
                this.isOptimizing = true;
                advancedControls.roundSize.checked = true;
                advancedControls.qrTypeNumber.value = '0';
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

            // Deactivation triggers
            case 'form-round-size':
              if (!advancedControls.roundSize.checked) {
                advancedControls.optimizeSize.checked = false;
              }
              genericUpdate();
              break;

            case 'form-qr-type-number':
              if (advancedControls.qrTypeNumber.value !== '0') {
                advancedControls.optimizeSize.checked = false;
              }
              genericUpdate();
              break;

            // Controls that re-run optimization if it's active
            case 'form-width':
            case 'form-height':
              if (isOptimized && !this.isOptimizing) {
                const newValue = parseInt(target.value) || 0;
                const increment = newValue > this.previousWidth ? 1 : -1;
                await this.handleOptimization(increment);
              } else {
                genericUpdate();
              }
              break;

            case 'form-margin':
              if (isOptimized) {
                await this.handleOptimization(0);
              } else {
                genericUpdate();
              }
              break;

            // All other controls fall through to the default generic update
            default:
              genericUpdate();
              break;
          }
        });
      }
    });
  }
}

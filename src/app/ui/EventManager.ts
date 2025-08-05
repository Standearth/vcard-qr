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
  private isOptimizing = false; // <<< FIX: Declare the missing property
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
      updateTabState(
        this.uiManager.getCurrentMode(),
        this.uiManager.getFormControlValues()
      );
      this.app.updateQRCode();
    };

    advancedControls.optimizeSize.addEventListener('input', async () => {
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
      }
    });

    advancedControls.width.addEventListener('input', () => {
      if (advancedControls.optimizeSize.checked && !this.isOptimizing) {
        const newWidth = parseInt(advancedControls.width.value) || 0;
        const increment = newWidth > this.previousWidth ? 1 : -1;
        this.handleOptimization(increment);
      } else {
        this.previousWidth = parseInt(advancedControls.width.value) || 0;
        genericUpdate();
      }
    });

    advancedControls.height.addEventListener('input', () => {
      if (advancedControls.optimizeSize.checked && !this.isOptimizing) {
        const newHeight = parseInt(advancedControls.height.value) || 0;
        const increment = newHeight > this.previousWidth ? 1 : -1;
        this.handleOptimization(increment);
      } else {
        genericUpdate();
      }
    });

    advancedControls.margin.addEventListener('input', () => {
      if (advancedControls.optimizeSize.checked) {
        this.handleOptimization(0);
      } else {
        genericUpdate();
      }
    });

    advancedControls.roundSize.addEventListener('input', () => {
      if (!advancedControls.roundSize.checked) {
        advancedControls.optimizeSize.checked = false;
      }
      genericUpdate();
    });

    advancedControls.qrTypeNumber.addEventListener('input', () => {
      if (advancedControls.qrTypeNumber.value !== '0') {
        advancedControls.optimizeSize.checked = false;
      }
      genericUpdate();
    });

    const handledIds = new Set([
      'form-optimize-size',
      'form-width',
      'form-height',
      'form-margin',
      'form-round-size',
      'form-qr-type-number',
    ]);

    Object.values(advancedControls).forEach((field) => {
      if (field instanceof HTMLElement && !handledIds.has(field.id)) {
        field.addEventListener('input', genericUpdate);
      }
    });
  }
}

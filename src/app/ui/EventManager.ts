import { dom } from '../../config/dom';
import { App } from '../App';
import { UIManager } from '../UIManager';
import { generateFilename } from '../../utils/helpers';
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

  constructor(app: App, uiManager: UIManager) {
    this.app = app;
    this.uiManager = uiManager;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
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

    Object.values(dom.advancedControls).forEach((field) => {
      if (field instanceof HTMLElement && field.id !== 'advanced-controls') {
        field.addEventListener('input', () => {
          updateTabState(
            this.uiManager.getCurrentMode(),
            this.uiManager.getFormControlValues()
          );
          this.app.updateQRCode();
        });
      }
    });

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
}

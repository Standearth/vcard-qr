import { dom } from '../../config/dom';
import { App } from '../App';
import { Mode, MODES } from '../../config/constants';
import { getTabState, updateTabState } from '../state';
import { UIManager } from './UIManager';

export class TabManager {
  private app: App;
  private uiManager: UIManager;

  constructor(app: App, uiManager: UIManager) {
    this.app = app;
    this.uiManager = uiManager;
  }

  switchTab(newMode: Mode, isInitialLoad = false): void {
    if (!isInitialLoad) {
      updateTabState(
        this.uiManager.getCurrentMode(),
        this.uiManager.getFormControlValues()
      );
    }
    this.uiManager.setCurrentMode(newMode);

    Object.keys(dom.tabLinks).forEach((key) => {
      const modeKey = key as keyof typeof dom.tabLinks;
      dom.tabLinks[modeKey].classList.toggle('active', modeKey === newMode);
      dom.formContainers[modeKey].classList.toggle(
        'active',
        modeKey === newMode
      );
      dom.formContainers[modeKey].classList.toggle(
        'hidden',
        modeKey !== newMode
      );
      dom.subHeadings[modeKey].classList.toggle('hidden', modeKey !== newMode);
    });

    dom.buttons.downloadVCard.style.display =
      newMode === MODES.VCARD ? 'block' : 'none';
    dom.anniversaryLogoContainer.style.display =
      newMode === MODES.WIFI ? 'none' : 'flex';

    const newTabState = getTabState(newMode);
    if (newTabState) {
      this.uiManager.setFormControlValues(newTabState);
    }

    if (!isInitialLoad) {
      this.app.updateQRCode();
    }
  }
}

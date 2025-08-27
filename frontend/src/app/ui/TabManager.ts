// src/app/ui/TabManager.ts

import { App } from '../App';
import { Mode } from '../../config/constants';
import { stateService } from '../StateService';
import { UIManager } from '../UIManager';

export class TabManager {
  private app: App;
  private uiManager: UIManager;

  constructor(app: App, uiManager: UIManager) {
    this.app = app;
    this.uiManager = uiManager;
  }

  switchTab(newMode: Mode, isInitialLoad = false): void {
    const currentMode = this.uiManager.getCurrentMode();

    if (!isInitialLoad) {
      const newValues = this.uiManager.getFormControlValues();
      stateService.updateState(currentMode, newValues);
    }

    this.uiManager.setCurrentMode(newMode);
    stateService.updateState(newMode, { activeMode: newMode });

    if (!isInitialLoad) {
      setTimeout(() => {
        this.uiManager.getStickyManager().handleStickyBehavior();
      }, 0);
    }
  }
}

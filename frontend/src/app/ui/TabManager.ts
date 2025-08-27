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
    if (!isInitialLoad) {
      const currentMode = this.uiManager.getCurrentMode();
      const newValues = this.uiManager.getFormControlValues();
      stateService.updateState(currentMode, newValues);
    }

    this.uiManager.getStickyManager().reInitializeDimensions();
    this.uiManager.setCurrentMode(newMode);

    // On a manual tab switch, trigger an update for the new tab.
    // This ensures computed state like `qrCodeContent` is regenerated.
    // The `updateState` method will also handle rendering the UI.
    if (!isInitialLoad) {
      stateService.updateState(newMode, {});
    } else {
      // On initial load, `handleRouteChange` calls `updateState` later,
      // so we only need to render the current state here.
      const newTabState = stateService.getState(newMode);
      if (newTabState) {
        this.uiManager.renderUIFromState(newTabState);
      }
    }

    if (!isInitialLoad) {
      this.app.updateQRCode();
      // Add the call to update the URL after switching tabs
      this.uiManager
        .getUrlHandler()
        .updateUrlFromState(stateService.getState(newMode)!);

      this.app.handleWebsiteChange();

      // After switching tabs, the form column height might have changed.
      // Re-evaluate the sticky layout immediately.
      // Use setTimeout to ensure the DOM has updated before calculations.
      setTimeout(() => {
        this.uiManager.getStickyManager().handleStickyBehavior();
      }, 0);
    }
  }
}

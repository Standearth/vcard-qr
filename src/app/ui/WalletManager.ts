import { dom } from '../../config/dom';
import { UIManager } from '../UIManager';
import { stateService } from '../StateService';
import { generateVCardForAppleWallet } from '../../utils/helpers';

export class WalletManager {
  private uiManager: UIManager;

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
    this.setupEventListeners();
    this.checkWalletVisibility();
  }

  private checkWalletVisibility(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('appleWallet') === 'true') {
      dom.buttons.addToWallet.classList.remove('hidden');
    }
  }

  private setupEventListeners(): void {
    dom.buttons.addToWallet.addEventListener('click', () => this.createPass());
  }

  private async createPass(): Promise<void> {
    const currentMode = this.uiManager.getCurrentMode();
    const state = stateService.getState(currentMode);

    if (!state) {
      console.error('No state available to generate pass.');
      return;
    }

    const vcard = generateVCardForAppleWallet(state);
    const anniversaryLogo = state.anniversaryLogo ?? false;

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

      const response = await fetch(`${apiBaseUrl}/api/create-pass`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vcard, anniversaryLogo }),
      });

      if (!response.ok) {
        throw new Error('Failed to create Apple Wallet pass');
      }

      const pass = await response.blob();
      const url = window.URL.createObjectURL(pass);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vcard.pkpass';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Error creating Apple Wallet pass:', error);
      // Optionally, show an error message to the user
    }
  }
}

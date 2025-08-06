import { dom } from '../../config/dom';
import { UIManager } from '../UIManager';

export class WalletManager {
  private uiManager: UIManager;

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    console.log(
      'Attempting to set up event listener for Add to Wallet button.',
      dom.buttons.addToWallet
    );
    dom.buttons.addToWallet.addEventListener('click', () => this.createPass());
  }

  private async createPass(): Promise<void> {
    const vCardData = this.uiManager.getFormManager().getVCardData();

    try {
      const response = await fetch('/api/create-pass', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vCardData),
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

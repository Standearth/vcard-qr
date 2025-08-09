// src/utils/helpers.ts

import { dom } from '../config/dom';
import { Mode, MODES, TabState } from '../config/constants';
import AsyncQRCodeStyling from '../lib/AsyncQRCodeStyling';
import { UIManager } from '../app/UIManager';
import { stateService } from '../app/StateService';
import { generateVCardString } from '@vcard-qr/shared-utils';

export function calculateAndApplyOptimalQrCodeSize(
  qrCodeInstance: AsyncQRCodeStyling,
  uiManager: UIManager,
  increment = 0
): void {
  if (!qrCodeInstance || !qrCodeInstance._qr) {
    return;
  }

  const moduleCount = qrCodeInstance._qr.getModuleCount();
  if (moduleCount === 0) {
    return;
  }

  const currentTabState = uiManager.getTabState();
  if (!currentTabState) return;

  const { width, height, margin } = currentTabState;
  const startingSize = Math.min(width || 0, height || 0);

  let pixelMultiplier = stateService.getPixelMultiplier(
    uiManager.getCurrentMode()
  );

  if (pixelMultiplier === 0) {
    pixelMultiplier = Math.round(startingSize / moduleCount);
  }

  pixelMultiplier += increment;

  const newSize = pixelMultiplier * moduleCount + (margin || 0) * 2;

  stateService.setPixelMultiplier(uiManager.getCurrentMode(), pixelMultiplier);
  uiManager.updateDimensions(newSize, newSize);
}

export function formatPhoneNumberForVCard(phoneNumber: string): string {
  if (!phoneNumber) return '';
  let cleanedNumber = phoneNumber.replace(/[^0-9,+]/g, '');
  if (/^\d{10}$/.test(cleanedNumber)) {
    cleanedNumber = `+1${cleanedNumber}`;
  }
  return cleanedNumber;
}

export function sanitizeFilename(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .replace(/__+/g, '_');
}

export function generateFilename(currentMode: Mode): string {
  if (currentMode === MODES.VCARD) {
    const namePart = [
      dom.formFields.firstName.value,
      dom.formFields.lastName.value,
    ]
      .map(sanitizeFilename)
      .filter(Boolean)
      .join('-');
    return `Stand-QR-vCard${namePart ? `-${namePart}` : ''}`;
  }
  if (currentMode === MODES.WIFI) {
    const ssid = sanitizeFilename(dom.formFields.wifiSsid.value);
    return `Stand-QR-WiFi-${ssid || 'network'}`;
  }
  if (currentMode === MODES.LINK) {
    try {
      let urlString = dom.formFields.linkUrl.value;
      if (!/^(https?|ftp):\/\//i.test(urlString))
        urlString = `https://${urlString}`;
      const fqdn = new URL(urlString).hostname;
      return `Stand-QR-URL-${sanitizeFilename(fqdn) || 'link'}`;
    } catch {
      return 'Stand-QR-URL-invalid_link';
    }
  }
  return 'qr-code';
}

export function generateQRCodeData(state: TabState, mode: Mode): string {
  const generators: Partial<Record<Mode, () => string>> = {
    [MODES.VCARD]: () => generateVCardString(state, false),
    [MODES.LINK]: () => state.linkUrl || 'https://stand.earth',
    [MODES.WIFI]: () => {
      return `WIFI:S:${state.wifiSsid || ''};T:${
        state.wifiEncryption || 'WPA'
      };P:${state.wifiPassword || ''};H:${
        state.wifiHidden ? 'true' : 'false'
      };;`;
    },
  };
  return generators[mode]!();
}

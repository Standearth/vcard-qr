import { dom } from '../config/dom';
import { Mode, MODES } from '../config/constants';

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
    } catch (e) {
      return 'Stand-QR-URL-invalid_link';
    }
  }
  return 'qr-code';
}

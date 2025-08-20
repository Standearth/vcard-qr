// src/config/constants.ts

import { Options } from 'qr-code-styling';

export const MODES = {
  VCARD: 'vcard',
  LINK: 'link',
  WIFI: 'wifi',
} as const;

export type Mode = (typeof MODES)[keyof typeof MODES];

export const DESKTOP_BREAKPOINT_PX = 768;

export const LOGO_URLS = {
  RED: '/Stand_Logo_Block-RGB_Red.svg',
  ANNIVERSARY: '/Stand.earth_25th-red_logo-teal_accent-RGB.svg',
  WIFI: '/Stand_WiFi.svg',
};

export type TabState = Partial<Options> & {
  anniversaryLogo: boolean;
  optimizeSize?: boolean;
  roundSize?: boolean;
  showImage?: boolean;
  dotHidingMode?: 'box' | 'shape' | 'off';
  isAdvancedControlsVisible?: boolean;
  isModalVisible?: boolean;
  qrCodeContent?: string;
  isQrCodeValid?: boolean;
  firstName?: string;
  lastName?: string;
  org?: string;
  title?: string;
  email?: string;
  officePhone?: string;
  extension?: string;
  workPhone?: string;
  cellPhone?: string;
  website?: string;
  linkedin?: string;
  notes?: string;
  linkUrl?: string;
  logoUrl: string;
  whatsapp?: string;
  wifiSsid?: string;
  wifiPassword?: string;
  wifiEncryption?: string;
  wifiHidden?: boolean;
};

export const DEFAULT_ADVANCED_OPTIONS: TabState = {
  width: 1080,
  height: 1080,
  margin: 10,
  dotsOptions: { type: 'dots', color: '#000000' },
  cornersSquareOptions: { type: 'rounded', color: '#000000' },
  cornersDotOptions: { type: 'rounded', color: '#e50b12' },
  backgroundOptions: { color: '#ffffff' },
  showImage: true,
  dotHidingMode: 'shape',
  imageOptions: { hideBackgroundDots: true, imageSize: 0.4, margin: 10 },
  qrOptions: { typeNumber: 0, errorCorrectionLevel: 'H' },
  anniversaryLogo: true,
  optimizeSize: false,
  roundSize: true,
  logoUrl: '',
};

export const TAB_SPECIFIC_DEFAULTS: Record<Mode, Partial<TabState>> = {
  [MODES.VCARD]: {},
  [MODES.LINK]: {},
  [MODES.WIFI]: {
    anniversaryLogo: false,
    imageOptions: {},
  },
};

export const DEFAULT_FORM_FIELDS = {
  firstName: '',
  lastName: '',
  org: import.meta.env.VITE_ORG_NAME || 'Example Organization',
  title: '',
  email: '',
  officePhone: '',
  extension: '',
  workPhone: '',
  cellPhone: '',
  website: import.meta.env.VITE_ORG_WEBSITE || 'https://www.example.com',
  linkedin: '',
  whatsapp: '',
  notes: '',
  linkUrl: import.meta.env.VITE_ORG_WEBSITE || 'https://www.example.com',
  wifiSsid: '',
  wifiPassword: '',
  wifiEncryption: 'WPA',
  wifiHidden: false,
};

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

export const OFFICE_PHONE_ALIASES: { [key: string]: string } = {
  SF: '+14158634563',
  BHAM: '+13607342951',
  VAN: '+16043316201',
};

export type TabState = Partial<Options> & { anniversaryLogo: boolean };

export const DEFAULT_ADVANCED_OPTIONS: TabState = {
  width: 500,
  height: 500,
  margin: 5,
  dotsOptions: { type: 'rounded', color: '#000000' },
  cornersSquareOptions: { type: undefined, color: '#000000' },
  cornersDotOptions: { type: undefined, color: '#e50b12' },
  backgroundOptions: { color: '#ffffff' },
  imageOptions: { hideBackgroundDots: true, imageSize: 0.4, margin: 5 },
  qrOptions: { typeNumber: 0, errorCorrectionLevel: 'Q' },
  anniversaryLogo: true,
};

export const TAB_SPECIFIC_DEFAULTS: { [key in Mode]: Partial<TabState> } = {
  [MODES.VCARD]: {
    width: 376,
    height: 376,
    margin: 10,
    qrOptions: { typeNumber: 18, errorCorrectionLevel: 'Q' },
    anniversaryLogo: true,
  },
  [MODES.LINK]: {
    qrOptions: { errorCorrectionLevel: 'H' },
    anniversaryLogo: true,
  },
  [MODES.WIFI]: {
    qrOptions: { errorCorrectionLevel: 'H' },
    anniversaryLogo: false,
  },
};

export const DEFAULT_FORM_FIELDS = {
  firstName: '',
  lastName: '',
  org: 'Stand.earth',
  title: '',
  email: '',
  officePhone: '',
  extension: '',
  workPhone: '',
  cellPhone: '',
  website: 'https://stand.earth',
  linkedin: '',
  linkUrl: 'https://stand.earth',
  wifiSsid: '',
  wifiPassword: '',
  wifiEncryption: 'WPA',
  wifiHidden: false,
};

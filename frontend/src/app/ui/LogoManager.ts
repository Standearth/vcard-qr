// frontend/src/app/ui/LogoManager.ts

import { Mode } from '../../config/constants';
import { stateService } from '../StateService';

// Define types for the logo configuration to ensure type safety
type LogoTemplate = {
  main?: string[];
  wifi?: string[];
};

type LogosConfig = {
  default?: LogoTemplate;
  [key: string]: LogoTemplate | undefined;
};

// Parse the config from the environment variable with a type assertion
const logosConfig: LogosConfig = JSON.parse(
  import.meta.env.VITE_LOGOS_CONFIG || '{}'
) as LogosConfig;

export class LogoManager {
  private _getDomainFromUrl(urlString: string): string {
    if (!urlString) return '';
    try {
      const urlWithProtocol = /^(https?:\/\/)/.test(urlString)
        ? urlString
        : `https://${urlString}`;
      const url = new URL(urlWithProtocol);
      return url.hostname.replace(/^www\./, '');
    } catch (_e) {
      return '';
    }
  }

  public getLogoOptions(website: string, mode: Mode): string[] {
    const domain = this._getDomainFromUrl(website);
    const currentState = stateService.getState(mode);
    const sessionLogos = currentState?.availableLogos || [];

    const domainTemplate = logosConfig[domain];
    const defaultTemplate = logosConfig.default;

    const logoSet = new Set<string>();
    sessionLogos.forEach((logo) => logoSet.add(logo));

    const addLogos = (template: LogoTemplate) => {
      if (mode === 'wifi' && template.wifi) {
        template.wifi.forEach((logo) => logo && logoSet.add(logo));
      } else if (template.main) {
        template.main.forEach((logo) => logo && logoSet.add(logo));
      }
    };

    if (domainTemplate) {
      addLogos(domainTemplate);
    }
    if (defaultTemplate) {
      addLogos(defaultTemplate);
    }

    return Array.from(logoSet);
  }

  public getDefaultLogoUrl(website: string, mode: Mode): string | undefined {
    const options = this.getLogoOptions(website, mode);
    return options.length > 0 ? options[0] : undefined;
  }
}

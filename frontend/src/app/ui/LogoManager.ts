// frontend/src/app/ui/LogoManager.ts

import { Mode } from '../../config/constants';
import logosConfig from '../../config/logos.json';
import { stateService } from '../StateService';

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

    const domainTemplate =
      logosConfig[domain as keyof typeof logosConfig] || {};
    const defaultTemplate = logosConfig.default;

    const logoSet = new Set<string>();
    sessionLogos.forEach((logo) => logoSet.add(logo));

    const addLogos = (template: { main?: string[]; wifi?: string[] }) => {
      if (mode === 'wifi' && template.wifi) {
        template.wifi.forEach((logo) => logo && logoSet.add(logo));
      } else if (template.main) {
        template.main.forEach((logo) => logo && logoSet.add(logo));
      }
    };

    addLogos(domainTemplate);
    addLogos(defaultTemplate);

    return Array.from(logoSet);
  }

  public getDefaultLogoUrl(website: string, mode: Mode): string | undefined {
    const options = this.getLogoOptions(website, mode);
    return options.length > 0 ? options[0] : undefined;
  }
}

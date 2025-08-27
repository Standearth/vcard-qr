// src/config/google-wallet-templates.ts

interface GoogleWalletTemplate {
  id: string;
  class: Record<string, unknown>;
  logo: Record<string, unknown>;
  hexBackgroundColor: string;
  heroImage?: Record<string, unknown> | null;
}

interface GooglePassConfig {
  default: GoogleWalletTemplate;
  templates: { [key: string]: Partial<GoogleWalletTemplate> };
}

let config: GooglePassConfig;

function isObject(item: unknown): item is Record<string, unknown> {
  return !!(item && typeof item === 'object' && !Array.isArray(item));
}

function deepMerge<T extends object, U extends object>(
  target: T,
  source: U
): T & U {
  const output = { ...target } as T & U;

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      const sourceValue = source[key as keyof U];
      if (isObject(sourceValue)) {
        if (!(key in target)) {
          Object.assign(output, { [key]: sourceValue });
        } else {
          (output as Record<string, unknown>)[key] = deepMerge(
            (target as Record<string, unknown>)[key] as T,
            sourceValue as U
          );
        }
      } else {
        Object.assign(output, { [key]: sourceValue });
      }
    });
  }

  return output;
}

export async function loadGooglePassConfig(): Promise<GooglePassConfig> {
  if (config) {
    return config;
  }

  let configString: string;

  if (process.env.NODE_ENV === 'production' && process.env.PASS_GOOGLE_CONFIG) {
    configString = process.env.PASS_GOOGLE_CONFIG;
  } else {
    try {
      const configPath = './google-wallet-templates.json';
      const passConfigModule = (await import(configPath, {
        with: { type: 'json' },
      })) as { default: GooglePassConfig };
      configString = JSON.stringify(passConfigModule.default);
    } catch (error) {
      console.error(
        'Could not load google-wallet-templates.json. Did you create it from the example?'
      );
      throw error;
    }
  }

  // Replace placeholder for issuer ID
  configString = configString.replace(
    /{{GOOGLE_ISSUER_ID}}/g,
    process.env.GOOGLE_ISSUER_ID || ''
  );

  try {
    config = JSON.parse(configString) as GooglePassConfig;
    return config;
  } catch (error) {
    console.error('Failed to parse Google Wallet pass configuration:', error);
    throw new Error('Invalid Google Wallet pass configuration.');
  }
}

export function getTemplateForEmail(
  email: string | undefined,
  passConfig: GooglePassConfig
): GoogleWalletTemplate {
  const domain = email?.split('@')[1];
  const templateConfig = domain ? passConfig.templates[domain] : undefined;

  if (templateConfig) {
    return deepMerge(passConfig.default, templateConfig);
  }

  return passConfig.default;
}

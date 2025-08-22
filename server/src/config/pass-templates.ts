// Remove the static import from the top of the file
// import passConfigData from './pass-templates.json' with { type: 'json' };

// Define interfaces for type safety
interface PassStyle {
  model: string;
  passTypeIdentifier: string;
  teamIdentifier: string;
  organizationName: string;
  description: string;
  foregroundColor: string;
  backgroundColor: string;
  labelColor: string;
}

interface Template extends PassStyle {
  domain: string;
}

interface PassConfig {
  default: PassStyle;
  templates: Template[];
}

let config: PassConfig;

export async function loadPassConfig(): Promise<PassConfig> {
  if (config) {
    return config;
  }

  // For production, load from an environment variable
  if (process.env.NODE_ENV === 'production' && process.env.PASS_CONFIG) {
    try {
      config = JSON.parse(process.env.PASS_CONFIG) as PassConfig;
      return config;
    } catch (error) {
      console.error('Failed to parse PASS_CONFIG environment variable:', error);
      throw new Error('Invalid pass configuration in environment variables.');
    }
  }

  // For development, dynamically import the JSON file
  try {
    // Use a variable to hold the path, preventing TSC from resolving it at build time
    const configPath = './pass-templates.json';
    const passConfigModule = await import(configPath, {
      with: { type: 'json' },
    });
    config = passConfigModule.default as PassConfig;
    return config;
  } catch (error) {
    console.error(
      'Could not load pass-templates.json. Did you create it from the example?'
    );
    throw error;
  }
}

export function getTemplateForEmail(
  email: string | undefined,
  config: PassConfig
): PassStyle {
  if (email) {
    const domain = email.split('@')[1];
    if (domain) {
      const template = config.templates.find((t) => t.domain === domain);
      if (template) {
        return template;
      }
    }
  }
  return config.default;
}

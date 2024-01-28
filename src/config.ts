import { userInfo } from 'os';
import { join } from 'path';
import { loadConfig } from 'c12';
import { type EnvironmentOptions } from './secrets-client';

export const CACHE_DIR = join(process.cwd(), '.eg2');
export const DEFAULTS_FILE = join(CACHE_DIR, 'defaults.json');

export const Placeholder = {
    service: 'eg2-app',
    stage: userInfo().username,
};

type Validator<T> = {
    [K in keyof T]: (value: any) => boolean;
};

const EnvironmentValidator: Validator<EnvironmentOptions> = {
    service: (service: string) =>
        typeof service === 'string' && service.length > 0,
    stage: (service: string) =>
        typeof service === 'string' && service.length > 0,
};

/**
 * Fetch environment options from the cached "metadata.json" file.
 * Does not throw on error, it just returns null.
 */
async function useCache() {
    try {
        const { default: cached } = await import(
            join(process.cwd(), '.eg2/defaults.json')
        );
        return cached;
    } catch (err) {
        return null;
    }
}

/**
 * Load configuration with the following priority:
 * 1. Overrides passed to the CLI
 * 2. package.json settings
 * 3. Saved config to .eg2/defaults.json
 * @param opts Command line options
 * @param validate Options to validate after fetching
 */
export async function options(
    overrides: EnvironmentOptions,
    validate: Array<keyof EnvironmentOptions> = ['service', 'stage'],
) {
    const cached = await useCache();
    const { config } = await loadConfig({
        overrides,
        packageJson: 'eg2',
        defaults: cached,
    });

    validate.forEach((prop) => {
        if (!EnvironmentValidator[prop](config[prop])) {
            throw new Error(`Option "--${prop}" is missing`);
        }
    });

    return config as EnvironmentOptions;
}

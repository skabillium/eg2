import { userInfo } from 'os';
import { join } from 'path';
import { type EnvironmentOptions } from './secrets-client';

export const CACHE_DIR = join(process.cwd(), '.eg2');
export const DEFAULTS_FILE = join(CACHE_DIR, 'defaults.json');

export const Placeholder = {
    service: 'eg2-app',
    stage: userInfo().username,
};

function areValidOptions(opts: EnvironmentOptions) {
    return (
        opts.service !== null &&
        opts.service !== undefined &&
        opts.service !== '' &&
        opts.stage !== null &&
        opts.stage !== undefined &&
        opts.stage !== ''
    );
}

/**
 * Fetch environment options from the cached "metadata.json" file.
 */
async function useCache() {
    const cached = await import(DEFAULTS_FILE);
    return cached.default;
}

/**
 * Validate and return options passed to the cli. If empty try to fetch them from
 * the cached "metadata.json" file. If it's not found there either throw error.
 * @param opts Command line options
 */
export async function options(opts: EnvironmentOptions) {
    let env = opts;
    if (!areValidOptions(opts)) {
        try {
            env = await useCache();

            for (let key in opts) {
                if (opts[key]) {
                    env[key] = opts[key];
                }
            }
        } catch (err) {
            if (err.code === 'ERR_MODULE_NOT_FOUND') {
                // TODO: Create a new error to avoid confusing logs
                err.message = 'Options "--service" and "--stage" are required';
            }

            throw err;
        }
    }
    return env;
}

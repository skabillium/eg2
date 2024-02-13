import { dirExists, printSecrets, printStrings } from './util';
import { useSecretsClient, type EnvironmentOptions } from './secrets-client';
import { CACHE_DIR, DEFAULTS_FILE, Placeholder, options } from './config';

export async function config() {
    // Get input for default stage
    const readline = await import('readline/promises');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const defaultStage = await rl.question(
        `Give a default stage for your variables (${Placeholder.stage}): `,
    );

    const service = await rl.question(
        `Give a name for your service (${Placeholder.service}): `,
    );

    rl.close();

    // Create ".eg2/defaults.json" file
    const fs = await import('fs/promises');
    const env: EnvironmentOptions = {
        service: !service || service === '' ? Placeholder.service : service,
        stage:
            !defaultStage || defaultStage === ''
                ? Placeholder.stage
                : defaultStage,
    };

    if (!(await dirExists(CACHE_DIR))) {
        await fs.mkdir(CACHE_DIR);
    }

    await fs.writeFile(DEFAULTS_FILE, JSON.stringify(env), 'utf8');
}

export async function set(
    name: string,
    value: string,
    opts: EnvironmentOptions,
) {
    const env = await options(opts);
    const client = useSecretsClient(env);

    await client.set(name, value);
    console.log(`Set ${client.key(name)} to ${value}`);
}

export async function get(name: string, opts: EnvironmentOptions) {
    const env = await options(opts);
    const client = useSecretsClient(env);

    const secret = await client.get(name);
    if (secret === null) {
        console.log('Secret', name, 'has not been set');
        return;
    }

    console.log(secret.value);
}

export async function list(opts: EnvironmentOptions) {
    const env = await options(opts);
    const client = useSecretsClient(env);

    const secrets = await client.list();

    if (secrets.length === 0) {
        console.log(`No serets set for stage "${env.stage}"`);
        return;
    }

    printSecrets(secrets);
}

export async function remove(name: string, opts: EnvironmentOptions) {
    const env = await options(opts);
    const client = useSecretsClient(env);

    const removed = await client.remove(name);

    if (!removed) {
        console.log('An error ocurred while removing', name);
        return;
    }

    console.log('Removed', name);
}

export async function load(path: string, opts: EnvironmentOptions) {
    const env = await options(opts);
    const client = useSecretsClient(env);

    const { readFile } = await import('fs/promises');
    const { parse } = await import('dotenv');
    const envfile = await readFile(path);

    const variables = parse(envfile);
    let totalVars = 0;
    for (let name in variables) {
        await client.set(name, variables[name]);
        totalVars++;
    }

    console.log(`Successfully uploaded ${totalVars} environment variables`);
}

export async function exportEnv(path: string, opts: EnvironmentOptions) {
    const env = await options(opts);
    const client = useSecretsClient(env);

    const { writeFile } = await import('fs/promises');

    const secrets = await client.list();
    const content = secrets.reduce<string>(
        (c, s) => c + `${s.name}="${s.value}"\n`,
        '',
    );

    await writeFile(path, content, 'utf8');
    console.log('Exported environment to', path);
}

export async function run(args: string[], opts: EnvironmentOptions) {
    const env = await options(opts);
    const client = useSecretsClient(env);

    const secrets = await client.list();

    const fetchedEnv = {};
    secrets.forEach((s) => {
        fetchedEnv[s.name] = s.value;
    });

    const { spawn } = await import('child_process');
    const cmd = args.shift();

    const proc = spawn(cmd, args, {
        stdio: 'inherit',
        env: { ...process.env, ...fetchedEnv },
    });

    proc.on('close', (code, signal) => {
        if (typeof code === 'number') {
            process.exit(code);
        } else {
            process.kill(process.pid, signal);
        }
    });
}

export async function stages(opts: EnvironmentOptions) {
    const env = await options(opts, ['service']);
    const client = useSecretsClient(env);

    const stages = await client.stages();

    if (stages.length === 0) {
        console.log(`No stages for service "${env.service}"`);
        return;
    }

    printStrings('Stages', stages);
}

export async function services(opts: EnvironmentOptions) {
    const env = await options(opts, ['service']);
    const client = useSecretsClient(env);

    const services = await client.services();

    if (services.length === 0) {
        console.log('No services found');
        return;
    }

    printStrings('Services', services);
}

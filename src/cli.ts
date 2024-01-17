import { join } from 'path';
import { userInfo } from 'os';
import { program } from 'commander';
import {
    SSMClient,
    PutParameterCommand,
    GetParameterCommand,
    GetParametersByPathCommand,
    DeleteParameterCommand,
    ParameterNotFound,
} from '@aws-sdk/client-ssm';

/**
 * The cli uses AWS SSM to store environment variables. Since SSM is a key-value store
 * we need to distinguish each app's variables by app name and also stage (eg. production,
 * quality, development). We could use the following key structure:
 * - /eg2/{service}/{stage}/{variable}
 */

/**
 * TODO:
 * - [ ] Check if we need to add a default region to config
 * - [ ] Use dependency injection for the SSM client, will help with future abstractions
 */

type EnvironmentOptions = {
    service: string;
    stage: string;
};

const CACHE_DIR = join(process.cwd(), '.eg2');
const METADATA = join(CACHE_DIR, 'metadata.json');

const Placeholder = {
    service: 'eg2-app',
    stage: userInfo().username,
};

const ssm = new SSMClient();

async function dirExists(path: string): Promise<boolean> {
    const fs = await import('fs/promises');
    try {
        const stat = await fs.stat(path);
        return stat.isDirectory();
    } catch (err) {
        return false;
    }
}

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
 * Validate and return options passed to the cli. If empty try to fetch them from
 * the cached "metadata.json" file. If it's not found there either throw error.
 * @param opts Command line options
 */
async function options(opts: EnvironmentOptions) {
    let env = opts;
    if (!areValidOptions(opts)) {
        try {
            const cached = await import(METADATA);
            env = cached.default;
        } catch (err) {
            if (err.code === 'ERR_MODULE_NOT_FOUND') {
                // TODO: Maybe handle this differently once logs are implemented.
                err.message = 'Options "--service" and "--stage" are required';
            }

            throw err;
        }
    }
    return env;
}

/**
 * Fetch environment options from the cached "metadata.json" file.
 */
async function useCache() {
    const cached = await import(METADATA);
    return cached.default;
}

async function config() {
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

    // Create ".eg2/metadata.json file"
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

    await fs.writeFile(METADATA, JSON.stringify(env), 'utf8');
}

function storageKey(name: string, env: EnvironmentOptions) {
    return storagePath(env) + '/' + name;
}

function storagePath(env: EnvironmentOptions) {
    return `/eg2/${env.service}/${env.stage}`;
}

async function set(name: string, value: string, opts: EnvironmentOptions) {
    const env = await options(opts);
    const key = storageKey(name, env);

    await ssm.send(
        new PutParameterCommand({
            Name: key,
            Value: value,
            Type: 'SecureString',
            Overwrite: true,
            Tier: value.length > 4096 ? 'Advanced' : 'Standard',
        }),
    );

    console.log(`Set ${key} to ${value}`);
}

async function get(name: string, opts: EnvironmentOptions) {
    try {
        const env = await options(opts);

        const param = await ssm.send(
            new GetParameterCommand({
                Name: storageKey(name, env),
                WithDecryption: true,
            }),
        );

        console.log(param.Parameter.Value);
    } catch (err) {
        if (err instanceof ParameterNotFound) {
            console.log(`Variable ${name} has not been set`);
            return;
        }
        throw err;
    }
}

async function list(opts: EnvironmentOptions) {
    const env = await options(opts);

    const params = await ssm.send(
        new GetParametersByPathCommand({
            Path: storagePath(env),
            WithDecryption: true,
        }),
    );

    printVars(
        params.Parameters.map((p) => ({
            name: p.Name.split('/').pop(),
            value: p.Value,
        })),
    );
}

async function remove(name: string, opts: EnvironmentOptions) {
    try {
        const env = await options(opts);
        await ssm.send(
            new DeleteParameterCommand({ Name: storageKey(name, env) }),
        );
        console.log('Removed', name);
    } catch (err) {
        if (err instanceof ParameterNotFound) {
            console.log(`Variable ${name} has not been set`);
            return;
        }
        throw err;
    }
}

async function load(path: string, opts: EnvironmentOptions) {
    const env = await options(opts);

    const { readFile } = await import('fs/promises');
    const { parse } = await import('dotenv');
    const envfile = await readFile(path);

    const variables = parse(envfile);
    let totalVars = 0;
    for (let name in variables) {
        await set(name, variables[name], env);
        totalVars++;
    }

    console.log(`Successfully uploaded ${totalVars} environment variables`);
}

async function exportEnv(path: string, opts: EnvironmentOptions) {
    const env = await options(opts);

    const { writeFile } = await import('fs/promises');
    const params = await ssm.send(
        new GetParametersByPathCommand({
            Path: storagePath(env),
            WithDecryption: true,
        }),
    );

    let content = '';
    params.Parameters.forEach((p) => {
        const name = p.Name.split('/').pop();
        const value = p.Value;

        content += `${name}="${value}"\n`;
    });

    await writeFile(path, content, 'utf8');
    console.log('Exported environment file to', path);
}

async function run(args: string[], opts: EnvironmentOptions) {
    const env = await options(opts);

    const params = await ssm.send(
        new GetParametersByPathCommand({
            Path: storagePath(env),
            WithDecryption: true,
        }),
    );

    const fetchedEnv = {};
    params.Parameters.forEach((p) => {
        fetchedEnv[p.Name.split('/').pop()] = p.Value;
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

// TODO: Handle large values
function printVars(vars: { name: string; value: string }[]) {
    const keyLen = Math.max(
        'Variables'.length,
        ...vars.map((v) => v.name.length),
    );
    const valueLen = Math.max(
        'Values'.length,
        ...vars.map((v) => v.value.length),
    );

    console.log(
        '┌'.padEnd(keyLen + 3, '─') + '┬' + ''.padEnd(valueLen + 2, '─') + '┐',
    );
    console.log(
        `│ ${'Variables'.padEnd(keyLen)} │ ${'Values'.padEnd(valueLen)} │`,
    );
    console.log(
        '├'.padEnd(keyLen + 3, '─') + '┼' + ''.padEnd(valueLen + 2, '─') + '┤',
    );

    vars.sort((a, b) => (a.name > b.name ? 1 : -1));

    vars.forEach((v) => {
        console.log(
            `| ${v.name.padEnd(keyLen)} | ${v.value.padEnd(valueLen)} |`,
        );
    });

    console.log(
        '└'.padEnd(keyLen + 3, '─') + '┴' + ''.padEnd(valueLen + 2, '─') + '┘',
    );
}

async function dg(opts: EnvironmentOptions) {
    const env = await options(opts);
    console.log(env);
}

program
    .name('eg2')
    .description('Cloud environment manager for AWS SSM')
    .option('--stage <stage>', 'Specify the stage for the command')
    .option('--service <service>', 'Specify the service for the command')
    .version('0.0.1');

program
    .command('set')
    .description('Set a new environment variable')
    .argument('<name>', 'Variable name')
    .argument('<value>', 'Variable value')
    .action((name: string, value: string) => set(name, value, program.opts()));

program
    .command('get')
    .description('Get an environment variable')
    .argument('<name>')
    .action((name: string) => get(name, program.opts()));

program
    .command('list')
    .alias('ls')
    .description('List all environment variables')
    .action(() => list(program.opts()));

program
    .command('remove')
    .alias('rm')
    .description('Remove an environment variable')
    .argument('<name>', 'Variable name')
    .action((name: string) => remove(name, program.opts()));

program
    .command('load')
    .description('Load environment from file')
    .argument('<path>', 'Path to environment file')
    .action((path: string) => load(path, program.opts()));

program
    .command('export')
    .description('Export environment to .env file')
    .argument('<path>', 'Path for exported .env file')
    .action((path: string) => exportEnv(path, program.opts()));

program
    .command('run [cmd...]')
    .description('Run a command with environment variables')
    .action((args: string[]) => run(args, program.opts()));

program
    .command('config')
    .description('Configure defaults for cli')
    .action(config);

program.command('dg').action(() => dg(program.opts()));

program.parse();

process.on('uncaughtException', (err) => console.log('Error:', err.message));

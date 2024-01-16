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
 * - /eg2/{appName}/{stage}/{variable}
 */

// TODO: Handle all process errors gracefully
// TODO: Check if we need to add a default region to config

type EnvironmentOptions = {
    service: string;
    stage: string;
};

const CACHE_DIR = join(process.cwd(), '.eg2');
const METADATA = join(CACHE_DIR, 'metadata.json');
const PACKAGE_JSON = join(process.cwd(), 'package.json');

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

async function bootstrap() {
    console.log('Bootstraping application...');

    // Get input for default stage
    const readline = await import('readline/promises');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const defaultStage = await rl.question(
        `Give a default stage for your variables (${Placeholder.stage}): `,
    );

    // Read service name from package.json, else prompt again
    const pkg = await import(PACKAGE_JSON);
    let service = pkg?.eg2?.service;
    if (!service) {
        service = await rl.question(
            `Give a name for your service (${Placeholder.service}): `,
        );
    }

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

    return env;
}

async function service(): Promise<EnvironmentOptions> {
    try {
        const { default: env } = await import(METADATA);
        return env as EnvironmentOptions;
    } catch (err) {
        if (err.code === 'ERR_MODULE_NOT_FOUND') {
            // First time running or "eg2" dir deleted, initialize it
            return bootstrap();
        }
        process.exit(1); // TODO: Throw error once all process errors are handled
    }
}

function storageKey(name: string, env: EnvironmentOptions) {
    return storagePath(env) + '/' + name;
}

function storagePath(env: EnvironmentOptions) {
    return `/eg2/${env.service}/${env.stage}`;
}

// TODO: Inject the SSM client
async function set(name: string, value: string) {
    const env = await service();
    const key = storageKey(name, env);

    await ssm.send(
        new PutParameterCommand({
            Name: key,
            Value: value,
            Type: 'SecureString',
            Overwrite: true,
        }),
    );

    console.log(`Set ${key} to ${value}`);
}

async function get(name: string) {
    try {
        const env = await service();
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
        console.log(err);
    }
}

async function list() {
    const env = await service();
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

async function remove(name: string) {
    try {
        const env = await service();
        await ssm.send(
            new DeleteParameterCommand({ Name: storageKey(name, env) }),
        );
        console.log('Removed', name);
    } catch (err) {
        if (err instanceof ParameterNotFound) {
            console.log(`Variable ${name} has not been set`);
            return;
        }
        console.log(err);
    }
}

async function load(path: string) {
    const { readFile } = await import('fs/promises');
    const { parse } = await import('dotenv');
    const envfile = await readFile(path);

    const variables = parse(envfile);
    let totalVars = 0;
    for (let name in variables) {
        await set(name, variables[name]);
        totalVars++;
    }

    console.log(`Successfully uploaded ${totalVars} environment variables`);
}

async function exportEnv(path: string) {
    const { writeFile } = await import('fs/promises');
    const env = await service();
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

async function run() {
    // TODO: Download env and spawn process
    const info = await service();
    console.log(info);
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

program
    .name('eg2')
    .description('Cloud environment manager for AWS SSM')
    .version('0.0.1');

program
    .command('set')
    .description('Set a new environment variable')
    .argument('<name>', 'Variable name')
    .argument('<value>', 'Variable value')
    .action(set);

program
    .command('get')
    .description('Get an environment variable')
    .argument('<name>')
    .action(get);

program
    .command('list')
    .alias('ls')
    .description('List all environment variables')
    .action(list);

program
    .command('remove')
    .alias('rm')
    .description('Remove an environment variable')
    .argument('<name>', 'Variable name')
    .action(remove);

program
    .command('load')
    .description('Load environment from file')
    .argument('<path>', 'Path to environment file')
    .action(load);

program
    .command('export')
    .description('Export environment to .env file')
    .argument('<path>', 'Path for exported .env file')
    .action(exportEnv);

program
    .command('run')
    .description('Run a command with environment variables')
    .action(run);

program.parse();

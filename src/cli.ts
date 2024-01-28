import { program } from 'commander';
import {
    set,
    get,
    list,
    remove,
    load,
    exportEnv,
    run,
    config,
    stages,
} from './commands';

program
    .name('eg2')
    .description('Cloud environment manager for AWS SSM')
    .option('--stage <stage>', 'Specify the stage for the command')
    .option('--service <service>', 'Specify the service for the command')
    .version('0.5.0');

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

program
    .command('stages')
    .description('Get all available stages')
    .action(() => stages(program.opts()));

program.parse();

process.on('uncaughtException', (err) => console.log('Error:', err.message));

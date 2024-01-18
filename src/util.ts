import { Secret } from './secrets-client';
/**
 * Check if a given directory exists in the file system
 * @param path Path to check
 * @returns {boolean} If the directory exists
 */
export async function dirExists(path: string): Promise<boolean> {
    const fs = await import('fs/promises');
    try {
        const stat = await fs.stat(path);
        return stat.isDirectory();
    } catch (err) {
        return false;
    }
}

/**
 * Print a list of secrets as a table on the command line
 * @param secrets List of secrets
 */
export function printSecrets(secrets: Secret[]) {
    const keyLen = Math.max(
        'Variables'.length,
        ...secrets.map((v) => v.name.length),
    );
    const valueLen = Math.max(
        'Values'.length,
        ...secrets.map((v) => v.value.length),
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

    secrets.sort((a, b) => (a.name > b.name ? 1 : -1));

    secrets.forEach((v) => {
        console.log(
            `| ${v.name.padEnd(keyLen)} | ${v.value.padEnd(valueLen)} |`,
        );
    });

    console.log(
        '└'.padEnd(keyLen + 3, '─') + '┴' + ''.padEnd(valueLen + 2, '─') + '┘',
    );
}

export function printStrings(label: string, values: string[]) {
    const valueLen = Math.max(label.length, ...values.map((v) => v.length));
    console.log('┌'.padEnd(valueLen + 3, '─') + '┐');
    console.log(`│ ${label.padEnd(valueLen)} │`);
    console.log('├'.padEnd(valueLen + 3, '─') + '┤');

    values.sort();

    values.forEach((v) => {
        console.log(`| ${v.padEnd(valueLen)} |`);
    });

    console.log('└'.padEnd(valueLen + 3, '─') + '┘');
}

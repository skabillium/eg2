import type { Secret } from './secrets-client';

/**
 * Check if a given directory exists in the file system
 * @param path Path to check
 */
export async function dirExists(path: string) {
    const fs = await import('fs/promises');
    try {
        const stat = await fs.stat(path);
        return stat.isDirectory();
    } catch (err) {
        return false;
    }
}

/**
 * Convert a string to pascal case
 * @example
 * toPascalCase("hello world") // "HelloWorld"
 * toPascalCase("snake_case")  // "SnakeCase"
 * toPascalCase("kebab-case")  // "KebabCase"
 * toPascalCase("camelCase")   // "CamelCase"
 */
export function toPascalCase(str: string) {
    return str
        .toLowerCase()
        .replace(new RegExp(/[-_]+/, 'g'), ' ')
        .replace(new RegExp(/[^\w\s]/, 'g'), '')
        .replace(
            new RegExp(/\s+(.)(\w*)/, 'g'),
            ($1, $2, $3) => `${$2.toUpperCase() + $3}`,
        )
        .replace(new RegExp(/\w/), (s) => s.toUpperCase());
}

/**
 * Print a list of secrets as a table on the command line
 * @param secrets List of secrets
 */
export function printSecrets(secrets: Secret[]) {
    const keyLen = Math.max(
        'Secrets'.length,
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
        `│ ${'Secrets'.padEnd(keyLen)} │ ${'Values'.padEnd(valueLen)} │`,
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

/**
 * Print a list of strings as a table
 * @param label Label for the table
 * @param values Values to print
 */
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

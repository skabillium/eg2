import { describe, expect, test } from '@jest/globals';
import { dirExists, toPascalCase } from '../src/util';

describe('Full test suite', () => {
    test('toPascalCase()', () => {
        expect(toPascalCase('hello world')).toBe('HelloWorld');
        expect(toPascalCase('snake_case')).toBe('SnakeCase');
        expect(toPascalCase('kebab-case')).toBe('KebabCase');
        expect(toPascalCase('camelCase')).toBe('Camelcase');
        expect(toPascalCase('PascalCase')).toBe('Pascalcase');
    });

    test('dirExists()', async () => {
        expect(await dirExists('node_modules')).toBe(true);
        expect(await dirExists('')).toBe(false);
        expect(await dirExists('other')).toBe(false);
    });
});

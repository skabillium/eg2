import { SecretsClientSSM } from './ssm-client';

export type EnvironmentOptions = {
    service: string;
    stage: string;
};

export type Secret = { name: string; value: string };

export interface SecretsClient {
    env: EnvironmentOptions;
    set(name: string, value: string): Promise<void>;
    get(name: string): Promise<Secret>;
    remove(name: string): Promise<boolean>;
    list(): Promise<Secret[]>;
    stages(): Promise<string[]>;
    services(): Promise<string[]>;
    key(name: string): string;
}

export function useSecretsClient(env: EnvironmentOptions): SecretsClient {
    return new SecretsClientSSM(env);
}

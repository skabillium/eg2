import {
    SSMClient,
    PutParameterCommand,
    GetParameterCommand,
    GetParametersByPathCommand,
    DeleteParameterCommand,
    ParameterNotFound,
} from '@aws-sdk/client-ssm';
import { SecretsClient, Secret, EnvironmentOptions } from 'secrets-client';

export class SecretsClientSSM implements SecretsClient {
    ssm: SSMClient;
    env: EnvironmentOptions;
    path: string;
    constructor(env: EnvironmentOptions) {
        this.ssm = new SSMClient();
        this.env = env;
        this.path = `/eg2/${env.service}/${env.stage}`;
    }

    async set(name: string, value: string): Promise<void> {
        await this.ssm.send(
            new PutParameterCommand({
                Name: this.key(name),
                Value: value,
                Type: 'SecureString',
                Overwrite: true,
                Tier: value.length > 4096 ? 'Advanced' : 'Standard',
            }),
        );
    }

    async get(name: string): Promise<Secret> {
        try {
            const res = await this.ssm.send(
                new GetParameterCommand({
                    Name: this.key(name),
                    WithDecryption: true,
                }),
            );

            return { name: res.Parameter.Name, value: res.Parameter.Value };
        } catch (err) {
            if (err instanceof ParameterNotFound) {
                return null;
            }

            throw err;
        }
    }

    async remove(name: string): Promise<boolean> {
        try {
            await this.ssm.send(
                new DeleteParameterCommand({ Name: this.key(name) }),
            );

            return true;
        } catch (err) {
            if (err instanceof ParameterNotFound) {
                return false;
            }
            throw err;
        }
    }

    async list(): Promise<Secret[]> {
        const res = await this.ssm.send(
            new GetParametersByPathCommand({
                Path: this.path,
                WithDecryption: true,
            }),
        );

        return res.Parameters.map((p) => ({
            name: this.nameFromPath(p.Name),
            value: p.Value,
        }));
    }

    nameFromPath(name: string): string {
        return name.split('/').pop();
    }

    key(name: string) {
        return this.path + '/' + name;
    }
}

# Eg2 Cloud environment manager

Eg2 is a command-line interface tool to help with managing your application secrets using the cloud.
Currently it only supports AWS SSM but more integrations are on the way. With Eg2 you can:

-   Create, read, update and delete secrets.
-   Load and export environments as `.env` files.
-   Run commands with an environment.

Eg2 supports setting multiple applications and stages offering a centralized store for all your
secrets.

## Installation

You will need at least [Node.js 18](https://nodejs.org/en) and [npm 7](https://www.npmjs.com/). Lastly make sure to [configure your AWS credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
locally.

After all that you can install the cli globaly:

```sh
npm install -g eg2
```

## Usage

Define a secret:

```sh
eg2 set REDIS_URL redis://localhost:6379 --service myapp --stage development
```

Load from `.env` file:

```sh
eg2 load .env --service myapp --stage development
```

Tip: You can run `eg2 config` to setup default values for the `--service` and `--stage` options. These
values are saved locally in your project's root directory to avoid conflicts with other projects.
After that you can omit these options when using the cli.

Run a command with a specified environment:

```sh
eg2 run --stage production node app.js
```

You can use the `--raw` or `-r` option when listing the secrets for a stage to output them to stdout
as an env file. The following command using the unix `env` command to run a script loading an
environment:

```sh
env $(eg2 list --raw) node app.js
```

Run `eg2 --help` for a more detailed specification.

## How it works

The cli uses AWS SSM to store environment variables. Since SSM is a key value store each application's
secrets have their own prefix, for the example application `my-api` you can find all variables stored
in the Systems Manager Dashboard under the prefix `/eg2/my-api/{stage}/{secret}`. So when you set a
secret `PASSWORD` for the `development` stage it will be saved as `/eg2/my-api/development/PASSWORD`.

## IAM Credentials

The permissions needed for all the basic operations are the following:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ssm:GetParameters",
                "ssm:GetParameter",
                "ssm:GetParametersByPath",
                "ssm:PutParameter",
                "ssm:DeleteParameter"
            ],
            "Resource": [
                "arn:aws:ssm:{REGION}:{ACCOUNT_ID}:parameter/{YOUR_PARAMETER_STORE_PATH}",
                "arn:aws:ssm:{REGION}:{ACCOUNT_ID}:parameter/{YOUR_PARAMETER_STORE_PATH}/*"
            ]
        }
    ]
}
```

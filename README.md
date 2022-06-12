# Personal Data Server

Personal Data Server can be used to save, retrieve, update and delete personal user data. This project is written in
[`node.js`](https://nodejs.org/en/) and uses [`Postgres`](https://www.postgresql.org/) as the backend database.

This project supports these authentication methods:

* Google Single Sign-on

## Getting Started

To work on the project, you need to:

* Install [NodeJS and NPM](https://nodejs.org/en/download/) for your operating system
* Clone the project from GitHub. [Create a fork](https://help.github.com/en/github/getting-started-with-github/fork-a-repo)
with your GitHub account, then run the following in your command line (make sure to replace `your-username` with
your username):

```bash
git clone https://github.com/your-username/personal-data-server
```

* Obtain Google OAuth 2.0 client credentials from the [Google API Console](https://console.developers.google.com/).
  See [Google Authentication Registration](./docs/GoogleSsoRegistration.md) for more details.

* From the root of the cloned project, run commands below to create `dataModel/SsoProvidersData.sql`

```bash
cp dataModel/SsoProvidersData.sql.example dataModel/SsoProvidersData.sql
```

* Edit `dataModel/SsoProvidersData.sql` to replace the string value at the line 17 and 18 with Google OAuth 2.0 client id
and client secret. This SQL file will be loaded into the database later

* Run the command below to start the server

```bash
npm start
```

* Open `http://localhost:3000/` in a browser demonstrates a process of Google Single Sign-on

### Clear Database

By default, running `npm start` will preserve the data in the database from previous runs. If a user wanted to
have a fresh start without any historical data, set the environment variable `PDS_CLEARDB` informs scripts to remove
the old database, re-create all tables and load initial data. Example:

```bash
export PDS_CLEARDB=true; npm start
```

### Skip Docker

By default, running `npm start` or `npm test` will start a Postgres docker container to serve the backend database.
However, as Docker is not supported by Windows OS, another option is to install Postgres locally and set the
environment variable `PDS_SKIPDOCKER` to inform scripts to skip the auto-start of a Postgres docker container. Example:

```bash
export PDS_SKIPDOCKER=true; npm start
```

Note: In order for the script to access the local Postgres database, you need to add a superuser account to the
Postgres with username `admin` and password `asecretpassword`. This account can be created using [the pgAdmin tool](https://www.pgadmin.org/)
in the "Login/Group Roles" section, or else via direct commands via [the psql driver](https://www.postgresql.org/docs/9.3/app-psql.html).

## Configuration

Personal Data Server is configured by [`config.json5`](./config.json5) defined in the root folder.
The configuration includes the server configuration and the database configuration. Every configuration
can be overridden by a corresponding environment variable.

* Server Configuration

| Name        | Default Value | Description | Envionment Variable for Overriding |
| ----------- | ----------- | ----------- | ----------- |
| port | 3000 | The port that the server will listen on | PDS_SERVERPORT |
| loginTokenExpiresIn | 86400 | The lifetime of login tokens in seconds | PDS_LOGINTOKENEXPIRESIN |
| allowedPrefsSize | 10K | The allowed size of the preferences object in bytes | PDS_ALLOWEDPREFSSIZE |
| selfDomain | <http://localhost:3000> | The domain that Personal Data Server uses. Referer URL of this domain is not tracked when SSO endpoints are called as the request is not issued externally. Note that a trailing slash should not be included. | |

* Database Configuration

| Name        | Default Value | Description | Envionment Variable for Overriding |
| ----------- | ----------- | ----------- | ----------- |
| dbContainerName | PersonalDataPostgres | The name of the postgres docker container | |
| dbDockerImage | postgres:14.1-alpine | The postgres docker image tag pulled from [the official docker image hub](https://hub.docker.com/_/postgres) | |
| database | personalData | The database name | PDS_DATABASE |
| host | localhost | The host that the personal data server starts on | PDS_DBHOST |
| port | 5432 | The port that the personal data server listens on | PDS_DBPORT |
| user | admin | The user created for creating the postgres database | PDS_DBUSER |
| password | asecretpassword | The password for the user | PDS_DBPASSWORD |

## Development

### Lint

Run the command below to lint Javascript, CSS, markdown JSON and JSON5 files in this project:

```bash
npm run lint
```

### Automated Tests

Run the command below to run all tests in this project:

```bash
npm test
```

## Documentation

The documentation for Personal Data Server can be found in the [`/docs`](./docs) folder.

### API

The Personal Data API can be found in the [API documentation](./docs/API.md).

### Helper Scripts

The [`/scripts`](./scripts) folder has helper scripts for performing individual actions on the backend database including:

* Start/stop the Postgres docker container
* Load data into the database in the Postgres docker container
* Drop the database in the Postgres docker container

The documentation for helper scripts can be found in the [Helper Scripts Documentation](./docs/HelperScripts.md).

## Deployments

### pds.fluidproject.org

The `main` branch of this repository is automatically deployed to [pds.fluidproject.org](https://pds.fluidproject.org) using a GitHub Actions [workflow](./.github/workflows/deploy-main.yml).

This deployment uses the `PDS_SERVERPORT` and `PDS_DOMAIN` environment variables (defined [here](https://github.com/fluid-project/personal-data-server/settings/secrets/actions) to customize the default settings.

The `PDS_DOMAIN` variable is set to `https://pds.fluidproject.org` and directly impacts how the `REDIRECT_URI` value is provided for SSO users.

The `PDS_SERVERPORT` variable is set to `38095` which is a staticly allocated port in the deployment server. If this needs to be changed for any reason, the change should also be reflected in the Ansible configuration repository (specifically, the load balancers group_vars).


## FAQ

### How to deal with the permission failure when trying to execute docker?

Use elevated permissions such as `sudo npm start`.

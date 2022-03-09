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
have a fresh start without any historical data, set the environment variable `CLEARDB` informs scripts to remove
the old database, re-create all tables and load initial data. Example:

```bash
export CLEARDB=true; npm start
```

### Skip Docker

By default, running `npm start` or `npm test` will start a Postgres docker container to serve the backend database.
However, as Docker is not supported by Windows OS, another option is to install Postgres locally and set the
environment variable `SKIPDOCKER` to inform scripts to skip the auto-start of a Postgres docker container. Example:

```bash
export SKIPDOCKER=true; npm start
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
| port | 3000 | The port that the server will listen on | SERVERPORT |

* Database Configuration

| Name        | Default Value | Description | Envionment Variable for Overriding |
| ----------- | ----------- | ----------- | ----------- |
| dbContainerName | PersonalDataPostgres | The name of the postgres docker container | |
| dbDockerImage | postgres:14.1-alpine | The postgres docker image tag pulled from [the official docker image hub](https://hub.docker.com/_/postgres) | |
| database | personalData | The database name | DATABASE |
| host | localhost | The host that the personal data server starts on | DBHOST |
| port | 5432 | The port that the personal data server listens on | DBPORT |
| user | admin | The user created for creating the postgres database | DBUSER |
| password | asecretpassword | The password for the user | DBPASSWORD |

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

### Helper Scripts

The [`/scripts`](./scripts) folder has helper scripts for performing individual actions on the backend database including:

* Start/stop the Postgres docker container
* Load data into the database in the Postgres docker container
* Drop the database in the Postgres docker container

The documentation for helper scripts can be found in the [`/docs`](./docs/HelperScripts.md) folder.

## FAQ

### How to deal with the permission failure when trying to execute docker?

Use elevated permissions such as `sudo npm start`.

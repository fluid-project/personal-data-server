# Postgres Database Objects and API

Accessing the database involves setting up postgres tables according to table
definitions, and adding, retrieving, and modifying the data within those tables.
A JavaScript class has been defined for performing these operations.

The implementation is a combination of [PostgreSQL](https://www.postgresql.org/),
[node-postgres](https://node-postgres.com/), [node-pg-format](https://github.com/datalanche/node-pg-format)
and code to handle SQL and JSON.  Requests made to the database that manipulate
the tables and their contents are given in the form of PostgreSQL strings.
Responses from the database are JSON.

## APIs

The library consists of a single JavaScript class that establishes a
connection to the data base (host, port, etc.) and provides an interface to
execute PostgresSQL commands.

### `class postgresOps`

The request for initializing the connection with the database and provides
a way to run SQL statements.  It extends the node-postgres [`Pool`](https://node-postgres.com/api/pool)
class; in particular, it inherits the `query()` method that is used to execute
SQL statements.

#### Configuration

The following options are set by passing a `config` object to `postgresOps`'s
constructor.  Integrators need to define these as appropriate to their
situation.

| Option            | Type       | Description |
| ----------------- | ---------- | ----------- |
| `databaseName`    | String     | Required. Name of the database containing the tables, e.g., `"personalData"` |
| `host`            | String     | Required. The host for the requests, e.g., `"localhost"` |
| `port`            | Integer    | Required. The port for the requests, e.g., `5432` |
| `user`            | String     | Required. User administrator's name, e.g., `"admin"`|
| `password`        | String     | Required for secure implementations. User administrator's password |

#### Operations API

##### `constructor(configuration)`

- `configuration {Object}` The database name, host, port, etc. -- see
["Configuration"](#Configuration) above.

##### `async runSql(sql, values)`

- `sql {String}` The SQL command(s) to run.
- `values {Array}` Optional array of values for parameters in the `sql` argument.
- Returns: `{Promise}` whose value is the result(s) of running the SQL
statement(s) in `sql`.

A wrapper around the inherited `query()` method, that adds an error handler
for logging errors.  The `sql` parameter can be a single SQL command or a
semi-colon separated list of commands.  An example of the former is:

``` .sql
SELECT * FROM users WHERE "user_id" = 'carla';
```

An example of the latter is:

``` .sql
DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='prefsSafesType') THEN
            CREATE TYPE "prefsSafesType" AS ENUM ('snapset', 'user');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='accessType') THEN
            CREATE TYPE "accessType" AS ENUM ('public', 'private', 'shared by trusted parties');
        END IF;
    END
$$;
CREATE TABLE "prefsSafes" (
    "prefsSafesId" VARCHAR(36) PRIMARY KEY NOT NULL,
    "safeType" "prefsSafesType" NOT NULL,
    name VARCHAR(64),
    password VARCHAR(64),
    email VARCHAR(32),
    preferences JSONB NOT NULL DEFAULT '{}'
);
INSERT INTO "prefsSafes" ("prefsSafesId", "safeType", name, password, email)
    VALUES ('prefsSafe-1', 'user', 'carla', 'null', 'someone@somewhere.com')
    RETURNING *
;

```

In both cases, the argument is a single `String`.

The method also supports parameterized statements, for example (note that the
`colourMap` column type is `JSONB`):

``` .sql
runSql(
    "INSERT INTO rgb (id, color, \"colourMap\") VALUES($1, $2, $3);",
    [
        "plum",
        "purple",
        { "name": "purple", "HSL": [306, 41, 40] }
    ]
);
```

The returned `Promise` is configured with an error handler that logs any error.

##### `async runSqlArray(sqlArray)`

- `sqlArray {Array}` An array of SQL statements.
- Returns: `{Promise}` A promise whose value array contains the results of
each SQL statement in the sequence of commands in the `sqlArray`.

A utility to run an array of SQL statements.

While there is no constraint on the order of the SQL statements in the input
array, this function can be used to define a logical sequence of database
requests, where the order of the commands is defined by their position in the
array.

##### `async runSqlFile(sqlFile)`

- `sqlFile {String}` Path to a file containing a set of SQL statements.
- Returns: `{Promise}` whose value is the result(s) of running the SQL
statement(s) in `sqlFile`.

Run SQL commands fetched from a file.  The file is constrained to contain any
number of well formed SQL statements.  Its contents are read asynchronously
and then executed.

##### `async loadFromJSON(tableName, jsonArray)`

- `tableName {String}` The name of the table to load with the given records.
- `jsonArray {Array}` An array of JSON objects containing the data to load into
the given table.
- Returns: `{Promise}` whose values is an array of successful INSERT results, or
an error message.

Bulk load the given records into the given table.  The records' JSON field
names must match the column names of the table, and the values of each field
contain the value to store in the corresponding column.  For columns that are
required and have no default value set, the JSON field must exist and its value
be of the correct type and match the range of values for that column.  For
table columns that are not required, or have a default value, the corresponding
JSON field can be missing.

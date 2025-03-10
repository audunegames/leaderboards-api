![GitHub last commit](https://img.shields.io/github/last-commit/audunegames/leaderboards-api)
![GitHub License](https://img.shields.io/github/license/audunegames/leaderboards-api)

# Audune Leaderboards API

**This repository contains the source code for the Leaderboards API by Audune Games.**

## Features

This package provides a REST API written in JavaScript to manage leaderboards and contestants for games or other tournaments. It uses a relational database as a backend to store the data, currently supporting SQLite and MySQL/MariaDB.

The REST API provides the following features:

- Create, modify, and delete boards with different score fields.
- Create, modify, and delete contestants that can submit a score to a board.
- Submit scores to a board for a contestant with specified values for the score fields in the board.
- Manage application keys and secrets that can authorize to the REST API.

For all features added in the lifespan of the repository, please refer to the [changelog file](blob/master/CHANGELOG.md).

## Installation

The provided [Dockerfile](blob/master/Dockerfile) builds an image that serves the REST API using NodeJS. An image from this Dockerfile will be built and published to the GitHub Container Registry on every push or pull request using a [GitHub action](blob/master/.github/workflows/docker-publish.yml).

You can pull the current version of the image with the following command:

```bash
$ docker pull ghcr.io/audunegames/leaderboards-api:master
```

Other versions of the package can be found [here](pkgs/container/leaderboards-api).

## Configuration

The REST API supports configuration via environment variables. The following environment variables can be set either directly, in a `.env` file, or in a Docker Compose configuration:

- `LEADERBOARD_DATABASE_URL` - A [Sequelize database URL](https://sequelize.org/api/v6/class/src/sequelize.js~sequelize#instance-constructor-constructor) to set up the database connection. Currently only the `sqlite` and `mysql` schemes are supported. (**required**).
- `LEADERBOARD_ADMIN_API_KEY` - The key for the administration application that will be set up automatically on the first run. Ideally should be 32 characters long and contain only `[a-z0-9]`, as that is how the REST API internally generates new application keys (**required**).
- `LEADERBOARD_ADMIN_API_SECRET` - The secret for the administration application. Ideally should be 32 characters long and contain only `[a-z0-9]`, as that is how the REST API internally generates new application secrets (**required**).
- `LEADERBOARD_AUTH_SECRET` - The secret used to sign JWT tokens for authentication. Should be minimal 32 characters long (**required**).
- `LEADERBOARD_SERVER_HOST` - The listen address for the HTTP server that serves the REST API. Defaults to `0.0.0.0` for IPv4 and `::` for IPv6.
- `LEADERBOARD_SERVER_PORT` - The listen port for the HTTP server. Defaults to `80`.
- `LEADERBOARD_SERVER_IPV6_ONLY` - Set to `true` if the HTTP server should only listen on IPv6. Defaults to `false`.
- `LEADERBOARD_LOGGING_LEVEL` - The logging level for the REST API. One of `debug`, `verbose`, `info`, `warn`, `error`. Defaults to `info`.

## Local development

Install Node.js and npm, then run the following commands to install the dependencies and serve the REST API in a development server that watches for file changes using [Nodemon](https://nodemon.io/):

```bash
$ npm install
$ npm run dev
```

## License

This package is licensed under the GNU LGPL 3.0 license. See the [license file](blob/master/LICENSE.txt) for more information.

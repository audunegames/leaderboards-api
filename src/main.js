const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const passport = require('passport');
const sequelize = require('sequelize');
const validator = require('validator');
const winston = require('winston');

const auth = require('./auth');
const models = require('./models');
const routes = require('./routes');
const utils = require('./utils');


// Array of valid logging levels
const loggingLevels = ['debug', 'verbose', 'info', 'warn', 'error'];


// Function to create the logger
function createLogger(loggingLevel) {
  return winston.createLogger({
    level: loggingLevel ?? 'info',
    format: winston.format.combine(
      winston.format.errors({stack: true}),
      winston.format.timestamp({format: 'HH:mm:ss.SSS'}),
      winston.format.cli({level: true, colors: {debug: 'gray', verbose: 'gray', info: 'green', warn: 'yellow', error: 'red'}}),
      winston.format.printf(info => `[${info.timestamp}] ${info.level} ${info.message}`)
    ),
    transports: [new winston.transports.Console()],
    exitOnError: false
  });
}

// Function to create the database
async function createDatabase(logger, databaseUrl) {
  // Create the database
  logger.info(`Connecting to database...`);
  const db = new sequelize.Sequelize(databaseUrl, {logging: msg => logger.debug(`Database: ${msg}`)});

  try {
    // Authenticate to the database
    await db.authenticate();

    // Add the models to the database
    models(db);

    // Sync the database
    await db.sync({alter: {drop: false}});

    // Return the database
    return db;
  } catch (err) {
    logger.error(`Could not connect to database: ${err}`);
    return;
  }
}

// Function to create the app
async function createApp(logger, db, adminCredentials, authSecret) {
  // Create the app
  logger.info(`Setting up the app...`);
  const app = express();

  try {
    // Set the locals of the app
    app.locals.logger = logger;
    app.locals.db = db;

    // Create the admin application
    const adminApplication = await models.Application.findByPk(adminCredentials.key);
    if (adminApplication === null) {
      logger.info(`Registering admin application with key ${JSON.stringify(adminCredentials.key)}`);
      await models.Application.create({key: adminCredentials.key, secret: adminCredentials.secret, name: "Admin Application", admin: true});
    } else {
      logger.info(`Admin application is already registered`);
    }

    // Configure the authentication strategies
    passport.use('basic', auth.basicStrategy(logger));
    passport.use('token', auth.tokenStrategy(logger, authSecret));
    passport.use('token-admin', auth.tokenStrategy(logger, authSecret, true));

    // Add the middlewares to the app
    app.use(utils.logRequest(logger));
    app.use(cors());
    app.use(bodyParser.json());
    app.use(passport.initialize());

    // Add the routes to the app
    routes(app, (key) => auth.generateToken(key, authSecret));

    // Add the error middleware to the app
    app.use(utils.respondWithError(logger));

    // Return the app
    return app;
  } catch (err) {
    logger.error(`Could not set up the app: ${err}`);
    return;
  }
}

// Function to run the server
function runServer(app, port, host, ipv6Only) {
  const server = app.listen({port, host, ipv6Only}, () => {
    var address = server.address();
    app.locals.logger.info(`Done! Server listening at ${address.family === 'IPv6' ? `[${address.address}]` : address.address}:${address.port}`)
  });

  process.on('SIGINT', () => {
    app.locals.logger.info('Received SIGINT, closing the server...');
    server.close(() => logger.info('Server closed'));
    process.exit();
  });
  process.on('SIGTERM', () => {
    app.locals.logger.info('Received SIGTERM, closing the server...');
    server.close(() => logger.info('Server closed'));
    process.exit();
  });

  return server;
}


// Main function
async function main() {
  // Load the settings from the environment
  dotenv.config();

  const loggingLevel = utils.validateEnvVariable('LEADERBOARD_LOGGING_LEVEL', {default: 'info' , validators: [s => loggingLevels.includes(s)]});
  const databaseUrl = utils.validateEnvVariable('LEADERBOARD_DATABASE_URL');
  const adminApiKey = utils.validateEnvVariable('LEADERBOARD_ADMIN_API_KEY');
  const adminApiSecret = utils.validateEnvVariable('LEADERBOARD_ADMIN_API_SECRET');
  const authSecret = utils.validateEnvVariable('LEADERBOARD_AUTH_SECRET', {validators: [s => validator.isLength(s, {min: 32})]});
  const serverHost = utils.validateEnvVariable('LEADERBOARD_SERVER_HOST', {default: ''});
  const serverPort = utils.validateEnvVariable('LEADERBOARD_SERVER_PORT', {default: 80, type: parseInt, validators: [validator.isPort]});
  const serverIPv6Only = utils.validateEnvVariable('LEADERBOARD_SERVER_IPV6_ONLY', {default: false, type: utils.parseBool, validators: [validator.isBoolean]});

  const adminCredentials = {key: adminApiKey, secret: adminApiSecret};

  console.log(databaseUrl);

  // Create the logger
  const logger = createLogger(loggingLevel);

  // Create the database
  const db = await createDatabase(logger, databaseUrl);
  if (db === undefined)
    return;

  // Create the app
  const app = await createApp(logger, db, adminCredentials, authSecret);
  if (app === undefined)
      return;

  // Run the server
  runServer(app, serverPort, serverHost, serverIPv6Only);
}


// Execute the main function
if (require.main === module) {
  main().catch(err => {
    console.error("An unexpected error occurred while running the app");
    console.error(err);
  });
}

const jwt = require('jsonwebtoken');
const passportHttp = require('passport-http');
const passportJwt = require('passport-jwt');

const models = require('./models');


// Constant that defines the audience for JWTs
const audience = "leaderboard-api";


// Define the basic authentication strategy
module.exports.basicStrategy = function(logger) {
  return new passportHttp.BasicStrategy(async function(key, secret, done) {
    try {
      // Get the application
      const application = await models.Application.findByPk(key);
      if (application === null) {
        logger.verbose(`Basic authentication failed because the application key is incorrect`);
        return done(null, false);
      }

      // Check if the secret matches the application secret
      if (secret !== application.secret) {
        logger.verbose(`Basic authentication failed because the application secret is incorrect`);
        return done(null, false);
      }

      // Return the authenticated application
      logger.verbose(`Basic authentication succeeded for application with key ${JSON.stringify(application.key)}`)
      return done(null, application);
    } catch (err) {
      // Handle the error
      logger.error(err);
      return done(err, false);
    }
  });
};

// Define the JWT authentication strategy
module.exports.tokenStrategy = function(logger, authSecret, requireAdmin = false) {
  return new passportJwt.Strategy({
    secretOrKey: authSecret,
    jwtFromRequest: passportJwt.ExtractJwt.fromAuthHeaderAsBearerToken(),
    audience: audience,
    algorithms: ['HS256']
  }, async function(jwt_payload, done) {
    try {      
      // Get the application
      const application = await models.Application.findByPk(jwt_payload.sub);
      if (application === null) {
        logger.verbose(`Token authentication failed because the subject in the JWT is incorrect`);
        return done(null, false);
      }

      // Check if the strategy requires administator privileges
      if (requireAdmin && !application.admin) {
        logger.verbose(`Token authentication failed because the subject in the JWT has no administrator privileges`);
        return done(null, false);
      }
        
      // Return the authenticated API key
      logger.verbose(`Token authentication succeeded for application with key ${JSON.stringify(application.key)}`)
      return done(null, application);
    } catch (err) {
      // Handle the error
      logger.error(err);
      return done(err, false);
    }
  });
};

// Generate a JWT for the specified app key and secret
module.exports.generateToken = function(key, authSecret) {
  return jwt.sign({}, authSecret, {
    expiresIn: '60m',
    audience: audience,
    subject: key,
  });
};

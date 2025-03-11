const httpError = require('http-errors');
const passport = require('passport');


// Return middleware to authenticate a request
module.exports.authenticate = function(strategy) {
  return function(req, res, next) {
    return passport.authenticate(strategy, function(err, application) {
      // Check if there is an error
      if (err)
        return next(err);

      // Check if the application is authenticated
      if (!application)
        return next(httpError.Unauthorized());

      // Assign the authenticated application to the request
      req.authenticatedApplication = application;

      // Handle the next middleware
      return next();
    })(req, res, next);
  };
};

// Return middleware that wraps another middleware function in a try-catch block
module.exports.catch = function(middleware) {
  return async function(req, res, next) {
    try {
      return await middleware(req, res, next);
    } catch (err) {
      return next(err);
    }
  };
};

// Return middleware that logs a request
module.exports.log = function(logger) {
  return function(req, res, next) {
    logger.verbose(`HTTP request from ${req.ip}: "${req.method} ${req.originalUrl}"`);
    return next();
  };
};

// Return middleware that responds with an error
module.exports.respondWithError = function(logger) {
  return function(err, req, res, next) {
    logger.error(`During request "${req.method} ${req.originalUrl}" an instance of ${err.name} was thrown: ${err.message}`);

    console.error("");
    console.error(err);
    console.error("");

    if (req.headersSent)
      return next(err);

    res.status(err.status ?? 500);
    res.json({error: err.name, message: err.message});
  };
};

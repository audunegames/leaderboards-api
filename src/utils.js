const httpError = require('http-errors');
const simpleflakes = require('simpleflakes');
const passport = require('passport');


// Apply the map function to all values in an object
module.exports.mapObject = function(object, mapFn) {
  return Object.keys(object).reduce(function(result, key) {
    result[key] = mapFn(object[key]);
    return result;
  }, {});
}

// Parse a boolean from the specified string
module.exports.parseBool = function(string, strict = true) {
  if (string === 'true' || string === '1') {
    return true;
  } else if (!strict || string === 'false' || string === '0') {
    return false;
  } else {
    throw new Error(`Invalid boolean value "${string}"`);
  }
};

// Validate an environment variables
module.exports.validateEnvVariable = function(name, options = {}) {
  options = {default: undefined, type: undefined, validators: [], ...options};

  // Check if the value exists
  const value = process.env[name];
  if (value === undefined) {
    if (options.default === undefined) {
      throw new Error(`The ${name} variable is not defined in the environment`); 
    } else {
      return options.default;
    }
  }

  // Validate the variable if applicable
  for (const validator of options.validators) {
    if (!validator(value)) {
      throw new Error(`The ${name} variable is not of the required format`);
    }
  }

  // Convert the value if applicable
  if (options.type !== undefined) {
    return options.type(value);
  } else {
    return value;
  }
};


// Generate a snowflake identifier
module.exports.generateId = function() {
  return simpleflakes.simpleflake(Date.now(), undefined, Date.UTC(2025, 1, 1)).toString(36);
}

// Generate an application key
module.exports.generateApplicationKey = function(length = 32) {
  let key = '';
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    key += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return key;
}


// Return middleware that wraps another middleware function in a try-catch block
module.exports.catchErrors = function(middleware) {
  return async function(req, res, next) {
    try {
      return await middleware(req, res, next);
    } catch (err) {
      return next(err);
    }
  };
};

// Return middleware to authenticate a request
module.exports.authenticate = function(strategy) {
  return function(req, res, next) {
    return passport.authenticate(strategy, function(err, application) {
      // Check if there is an error
      if (err)
        return next(err);

      // Check if the application is authenticated
      if (!application)
        return next(httpError.Unauthorized(err));

      // Assign the authenticated application to the request
      req.authenticatedApplication = application;

      // Handle the next middleware
      return next();
    })(req, res, next);
  };
};

// Return middleware that logs a request
module.exports.logRequest = function(logger) {
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

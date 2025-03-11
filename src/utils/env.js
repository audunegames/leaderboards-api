// Validate an environment variable
module.exports.validate = function(name, options = {}) {
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
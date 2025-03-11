const simpleflakes = require('simpleflakes');


// Generate a key
module.exports.key = function(length = 32) {
  let key = '';
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    key += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return key;
};

// Generate a snowflake
module.exports.snowflake = function() {
  return simpleflakes.simpleflake(Date.now(), undefined, Date.UTC(2025, 1, 1)).toString(36);
};

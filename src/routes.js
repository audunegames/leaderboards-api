const applicationsControllers = require('./controllers/applications');
const boardsControllers = require('./controllers/boards');
const contestantsControllers = require('./controllers/contestants');

const middleware = require('./utils/middleware');


// Configure the routes on the app
module.exports = async function(app, generateToken) {
  // Add the authenticate route
  app.post('/authenticate',
    middleware.authenticate('basic'),
    middleware.catch(async function(req, res, next) {
      // Create a token for the authenticated application
      const token = generateToken(req.authenticatedApplication.key);

      // Respond with the token
      return res.json({token: token});
    }));

  // Create the routes
  app.use('/applications', applicationsControllers(app));
  app.use('/contestants', contestantsControllers(app));
  app.use('/boards', boardsControllers(app));
};

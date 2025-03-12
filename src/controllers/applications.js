const express = require('express');
const httpError = require('http-errors');

const models = require('../models');

const ids = require('../utils/ids');
const middleware = require('../utils/middleware');


// Configure the router
module.exports = function(app) {
  // Create the router
  const router = express.Router();

  // Fetch an application from a parameter
  router.param('applicationKey', async function(req, res, next, key) {
    try {
      // Get the application
      req.application = await models.Application.findByPk(key);
      if (req.application === null)
        return next(httpError.NotFound(`Could not find application with key ${JSON.stringify(key)}`));

      // Handle the request
      next();
    } catch (err) {
      // Handle the error
      next(err);
    }
  });

  // Add the create application route
  router.post('/',
    middleware.authenticate('token-admin'),
    middleware.catch(async function(req, res, next) {
      // Create the application
      const application = await models.Application.create({
        key: ids.key(),
        secret: ids.key(),
        name: req.body.name,
        admin: req.body.admin || false,
      });

      // Respond with the application
      req.app.locals.logger.verbose(`Created application with key ${JSON.stringify(application.key)}`);
      return res.status(201).json(await application.toAPI(['secret']));
    }));

  // Add the list application route
  router.get('/',
    middleware.authenticate('token-admin'),
    middleware.catch(async function(req, res, next) {
      // Get the applications
      const applications = await models.Application.findAll();

      // Respond with the applications
      return res.json(await models.Application.arrayToAPI(applications));
    }));

  // Add the get application route
  router.get('/:applicationKey',
    middleware.authenticate('token-admin'),
    middleware.catch(async function(req, res, next) {
      // Respond with the application
      return res.json(await req.application.toAPI());
    }));

  // Add the modify application route
  router.patch('/:applicationKey',
    middleware.authenticate('token-admin'),
    middleware.catch(async function(req, res, next) {
      // Modify the application
      if (req.body.name !== undefined)
        req.application.name = req.body.name;
      if (req.body.admin !== undefined)
        req.application.admin = req.body.admin;
      await req.application.save();

      // Respond with the application
      req.app.locals.logger.verbose(`Modified application with key ${JSON.stringify(req.application.key)}`);
      return res.json(await req.application.toAPI());
    }));

  // Add the remove application route
  router.delete('/:applicationKey',
    middleware.authenticate('token-admin'),
    middleware.catch(async function(req, res, next) {
      // Remove the application
      req.application.destroy();

      // Respond with no content
      req.app.locals.logger.verbose(`Removed application with key ${JSON.stringify(req.application.key)}`);
      return res.status(204).send();
    }));

  // Return the router
  return router;
};

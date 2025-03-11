const express = require('express');
const httpError = require('http-errors');

const models = require('../models');

const ids = require('../utils/ids');
const middleware = require('../utils/middleware');


// Configure the router
module.exports = function(app) {
  // Create the router
  const router = express.Router();

  // Fetch a contestant from a parameter
  router.param('contestantId', async function(req, res, next, contestantId) {
    try {
      // Get the contestant
      req.contestant = await models.Contestant.findByPk(contestantId, {include: models.Contestant.Scores});
      if (req.contestant === null)
        return next(httpError.NotFound(`Could not find contestant with identifier ${JSON.stringify(contestantId)}`));

      // Handle the request
      next();
    } catch (err) {
      // Handle the error
      next(err);
    }
  });

  // Add the create contestant route
  router.post('/',
    middleware.authenticate('token'),
    middleware.catch(async function(req, res, next) {
      // Create the contestant
      const contestant = await models.Contestant.create({
        id: ids.snowflake(),
        name: req.body.name,
      });

      // Respond with the contestant
      req.app.locals.logger.verbose(`Created contestant with identifier ${JSON.stringify(contestant.id)}`);
      return res.status(201).json(await contestant.toOutputObject());
    }));

  // Add the list contestants route
  router.get('/',
    middleware.authenticate('token'),
    middleware.catch(async function(req, res, next) {
      // Get the contestants
      const contestants = await models.Contestant.findAll();

      // Respond with the contestants
      return res.json(await Promise.all(contestants.map(async contestant => await contestant.toOutputObject())));
    }));

  // Add the get contestant route
  router.get('/:contestantId',
    middleware.authenticate('token'),
    middleware.catch(async function(req, res, next) {
      // Respond with the contestant
      return res.json(await req.contestant.toOutputObject());
    }));

  // Add the modify contestant route
  router.patch('/:contestantId',
    middleware.authenticate('token'),
    middleware.catch(async function(req, res, next) {
      // Modify the contestant
      if (req.body.name !== undefined)
        req.contestant.name = req.body.name;
      await req.contestant.save();

      // Respond with the contestant
      req.app.locals.logger.verbose(`Modified contestant with identifier ${JSON.stringify(contestant.id)}`);
      return res.json(await req.contestant.toOutputObject());
    }));

  // Add the remove contestant route
  router.delete('/:contestantId',
    middleware.authenticate('token'),
    middleware.catch(async function(req, res, next) {
      // Remove the contestant
      req.contestant.destroy();

      // Respond with no content
      req.app.locals.logger.verbose(`Removed contestant with identifier ${JSON.stringify(contestant.id)}`);
      return res.status(204).send();
    }));

  // Return the router
  return router;
};

const express = require('express');
const httpError = require('http-errors');

const models = require('../models');

const ids = require('../utils/ids');
const middleware = require('../utils/middleware');



// Configure the router
module.exports = function(app) {
  // Create the router
  const router = express.Router();

  // Fetch a board from a parameter
  router.param('boardId', async function(req, res, next, boardId) {
    try {
      // Get the board
      req.board = await models.Board.findByPk(boardId, {include: [models.Board.Fields, models.Board.Scores]});
      if (req.board === null)
        return next(httpError.NotFound(`Could not find board with identifier ${JSON.stringify(boardId)}`));

      // Handle the request
      next();
    } catch (err) {
      // Handle the error
      next(err);
    }
  });

  // Add the create board route
  router.post('/',
    middleware.authenticate('token-admin'),
    middleware.catch(async function(req, res, next) {
      // Create the board
      const board = await models.Board.create({
        id: ids.snowflake(),
        name: req.body.name,
        fields: models.Field.inputObjectToArray(req.body.fields, ids.snowflake),
      }, {include: [models.Board.Fields]});

      // Respond with the board
      req.app.locals.logger.verbose(`Created board with identifier ${JSON.stringify(board.id)}`);
      return res.status(201).json(await board.toOutputObject());
    }));

  // Add the list boards route
  router.get('/',
    middleware.authenticate('token'),
    middleware.catch(async function(req, res, next) {
      // Get the boards
      const boards = await models.Board.findAll();

      // Respond with the boards
      return res.json(boards.map(async board => await board.toOutputObject()));
    }));

  // Add the get board route
  router.get('/:boardId',
    middleware.authenticate('token'),
    middleware.catch(async function(req, res, next) {
      // Respond with the board
      return res.json(await req.board.toOutputObject());
    }));

  // Add the modify board route
  router.patch('/:boardId',
    middleware.authenticate('token-admin'),
    middleware.catch(async function(req, res, next) {
      // Modify the board
      if (req.body.name !== undefined)
        req.board.name = req.body.name;
      await req.board.save();

      // Respond with the boards
      req.app.locals.logger.verbose(`Modified board with identifier ${JSON.stringify(req.board.id)}`);
      return res.json(await req.board.toOutputObject());
    }));

  // Add the remove board route
  router.delete('/:boardId',
    middleware.authenticate('token-admin'),
    middleware.catch(async function(req, res, next) {
      // Remove the board
      req.board.destroy();

      // Respond with no content
      req.app.locals.logger.verbose(`Removed board with identifier ${JSON.stringify(req.board.id)}`);
      return res.status(204).send();
    }));

  // Add the submit score to board route
  router.post('/:boardId/scores/:contestantId',
    middleware.authenticate('token'),
    middleware.catch(async function(req, res, next) {
      // Get the contestant
      const contestant = await models.Contestant.findByPk(req.params.contestantId);
      if (contestant == null)
        return next(httpError.NotFound(`Could not find contestant with identifier ${JSON.stringify(req.params.contestantId)}`));
      
      req.app.locals.logger.debug(`Attempting to submit score for board with identifier ${JSON.stringify(req.board.id)} and contestant with identifier ${JSON.stringify(contestant.id)}`);

      // Get the fields
      const fields = await req.board.getFields();

      // Iterate over the fields in the board to fetch existing scores
      const entries = [];
      for (const field of fields) {
        // Check if the field exists in the body
        const value = req.body[field.name];
        if (value === undefined)
          throw httpError.NotFound(`Could not find field with name ${JSON.stringify(field.name)} in the request body`);

        // Check if a score for the board, contestant, and field already exists
        const score = await models.Score.findOne({where: {boardId: req.board.id, contestantId: contestant.id, fieldId: field.id}});
        if (score !== null) {
          const isBest = field.compare(score.value, value) < 0;
          entries.push({field: field, score: score, newValue: value, newValueIsBest: isBest});
          req.app.locals.logger.debug(`Found existing score for field with name ${field.name}: {newValue: ${value}, value: ${score.value}, newValueIsBest: ${isBest}}`);
        } else {
          entries.push({field: field, score: null, newValue: value, newValueIsBest: true});
          req.app.locals.logger.debug(`New score for field with name ${field.name}: {newValue: ${value}}`);
        }
      }

      // Update the score if the new score is the best score
      if (entries.some(({score}) => score === null) || entries.some(({newValueIsBest}) => newValueIsBest)) {
        req.app.locals.logger.debug(`The new score is best score, so update the score`);
        
        // Iterate over the existing scores
        for (const entry of entries) {
          // Check if the existing score is defined
          if (entry.score !== null) {
            // Modify the existing score
            entry.score.value = entry.newValue;
            await entry.score.save();
          } else {
            // Create a new score
            entry.score = await models.Score.create({
              id: ids.snowflake(),
              boardId: req.board.id,
              contestantId: contestant.id,
              fieldId: entry.field.id,
              value: entry.newValue,
            });
          }
        }
      } else {
        req.app.locals.logger.debug(`The existing score is best score, so leave the score unchanged`);
      }

      // Respond with the board
      return res.json(await models.Score.arrayToOutputObjectGroupByContestant(entries.map(entry => entry.score)));
    }));

  // Return the router
  return router;
};

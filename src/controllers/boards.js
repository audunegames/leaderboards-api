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
      req.board = await models.Board.findByPk(boardId, {include: [models.Board.Fields, {association: models.Board.Entries, include: [models.ScoreEntry.Values]}]});
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
        fields: Object.entries(req.body.fields).map(([name, object]) => ({
          ...object,
          name: name,
          id: ids.snowflake()
        })),
      }, {include: [models.Board.Fields]});

      // Respond with the board
      req.app.locals.logger.verbose(`Created board with identifier ${JSON.stringify(board.id)}`);
      return res.status(201).json(await board.toAPI(['fields']));
    }));

  // Add the list boards route
  router.get('/',
    middleware.authenticate('token'),
    middleware.catch(async function(req, res, next) {
      // Get the boards
      const boards = await models.Board.findAll();

      // Respond with the boards
      return res.json(await models.Board.arrayToAPI(boards, ['fields', 'entries']));
    }));

  // Add the get board route
  router.get('/:boardId',
    middleware.authenticate('token'),
    middleware.catch(async function(req, res, next) {
      // Respond with the board
      return res.json(await req.board.toAPI(['fields', 'entries']));
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
      return res.json(await req.board.toAPI(['fields', 'entries']));
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
  router.post('/:boardId/submit/:contestantId',
    middleware.authenticate('token'),
    middleware.catch(async function(req, res, next) {
      // Get the contestant
      const contestant = await models.Contestant.findByPk(req.params.contestantId);
      if (contestant == null)
        return next(httpError.NotFound(`Could not find contestant with identifier ${JSON.stringify(req.params.contestantId)}`));

      // Get the fields and their values from the request body
      const fields = [];
      for (const field of await req.board.getFields()) {
        // Check if the field exists in the body
        const value = req.body.values[field.name];
        if (value === undefined)
          throw httpError.NotFound(`Could not find field with name ${JSON.stringify(field.name)} in the request body`);

        // Set the value
        fields.push({field, value});
      }

      // Sort the fields
      fields.sort((a, b) => a.field.sortOrder - b.field.sortOrder);

      // Create a new score entry
      let entry = models.ScoreEntry.build({
        id: ids.snowflake(),
        boardId: req.board.id,
        contestantId: contestant.id,
        gameVersion: req.body.gameVersion || null,
        gamePlatform: req.body.gamePlatform || null,
        values: fields.map(({field, value}) => ({
          id: ids.snowflake(),
          fieldId: field.id,
          value: value,
        })),
      }, {include: [models.ScoreEntry.Values]})

      // Check if a score entry for the board and contestant already exists
      const existingEntry = await models.ScoreEntry.findOne({where: {boardId: req.board.id, contestantId: contestant.id}, include: [models.ScoreEntry.Values]});
      if (existingEntry != null) {
        // Calculate which entry has the best values
        let bestEntry = 0;
        for (const {field, value} of fields) {
          const existingValue = existingEntry.values.find(value => value.fieldId == field.id);
          bestEntry = field.compareValues(existingValue.value, value);
          if (bestEntry !== 0)
            break;
        }

        // Check if the new entry has the best values
        if (bestEntry > 0) {
          // Update the existing entry
          await existingEntry.update({gameVersion: entry.gameVersion, gamePlatform: entry.gamePlatform});
          await existingEntry.save();

          for (const {field, value} of fields) {
            const existingValue = existingEntry.values.find(value => value.fieldId == field.id);
            await existingValue.update({value: value});
            await existingValue.save();
          }
        }

        // Overwrite the entry
        entry = existingEntry;
      } else {
        // Save the new score entry
        await entry.save();
      }

      // Respond with the entry
      req.app.locals.logger.verbose(`Submitted score for board with identifier ${JSON.stringify(req.board.id)} and contestant with identifier ${JSON.stringify(contestant.id)}`);
      return res.json(await entry.toAPI());
    }));

  // Return the router
  return router;
};

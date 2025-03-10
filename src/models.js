const { Model, DataTypes } = require('sequelize');


// Class that defines an application
class Application extends Model
{
  // Convert the application to an ouput object
  async toOutputObject(includeSecret = false) {
    const output = {key: this.key, name: this.name, admin: this.admin};
    if (includeSecret)
      output.secret = this.secret;
    return output;
  }
}

// Class that defines a contestant
class Contestant extends Model
{
  // Convert the contestant to an ouput object
  async toOutputObject() {
    const output = this.toJSON();
    if (output.scores !== undefined)
      output.scores = await Score.arrayToOutputObjectGroupByBoard(output.scores);
    return output;
  }
}

// Class that defines a board
class Board extends Model
{
  // Convert the contestant to an ouput object
  async toOutputObject() {
    const output = this.toJSON();
    if (output.fields !== undefined)
      output.fields = await Field.arrayToOutputObject(output.fields);
    if (output.scores !== undefined)
      output.scores = await Score.arrayToOutputObjectGroupByContestant(output.scores);
    return output;
  }
}

// Class that defines a field
class Field extends Model
{
  // Compare two values based on the field
  compare(a, b) {
    if (a === undefined || b === undefined)
      throw new Error('One or both operands are undefined');

    if (this.sortDescending)
      return a - b;
    else
      return b - a;
  }

  // Convert an array of fields to an ouput object
  static async arrayToOutputObject(fields) {
    const output = {};
    for (const field of fields)
      output[field.name] = {sortOrder: field.sortOrder, sortDescending: field.sortDescending};
    return output;
  }

  // Convert an input object to an array of fields
  static inputObjectToArray(input, generateId = undefined) {
    const fields = [];
    for (const fieldName in input) {
      const field = {...input[fieldName], name: fieldName};
      if (generateId !== undefined)
        field.id = generateId();
      fields.push(field);
    }
    return fields;
  }
}

// Class that defines a score
class Score extends Model
{
  // Convert an array of scores to an output object
  static async arrayToOutputObject(scores, options) {
    const outputArray = [];
    const groupedScores = Object.groupBy(scores, options.groupFn);
    for (const [id, scores] of Object.entries(groupedScores)) {
      const output = {scores: {}};
      output[options.name] = await options.resolveFn(id);
      for (const score of scores) {
        const field = await Field.findByPk(score.fieldId);
        output.scores[field.name] = score.value;
      }
      outputArray.push(output);
    }
    return outputArray;
  }

  // Convert an array of scores to an output object, grouped by the board of the score
  static async arrayToOutputObjectGroupByBoard(scores) {
    return await Score.arrayToOutputObject(scores, {
      name: 'board',
      groupFn: score => score.boardId, 
      resolveFn: async id => await Board.findByPk(id),
    });
  }

  // Convert an array of scores to an output object, grouped by the contestant of the score
  static async arrayToOutputObjectGroupByContestant(scores) {
    return await Score.arrayToOutputObject(scores, {
      name: 'contestant',
      groupFn: score => score.contestantId, 
      resolveFn: async id => await Contestant.findByPk(id),
    });
  }
}


// Configure the database models on the app
module.exports = function(db) {
  // Define the application model
  Application.init({
    key: {type: DataTypes.STRING, primaryKey: true, allowNull: false},
    secret: {type: DataTypes.STRING, allowNull: false},
    name: {type: DataTypes.STRING, allowNull: false},
    admin: {type: DataTypes.BOOLEAN, allowNull: false, default: false},
  }, {sequelize: db, tableName: 'applications'});

  // Define the contestant model
  Contestant.init({
    id: {type: DataTypes.STRING, primaryKey: true, allowNull: false},
    name: {type: DataTypes.STRING, allowNull: false},
  }, {sequelize: db, tableName: 'contestants'});

  // Define the board model
  Board.init({
    id: {type: DataTypes.STRING, primaryKey: true, allowNull: false},
    name: {type: DataTypes.STRING, allowNull: false},
  }, {sequelize: db, tableName: 'boards'});

  // Define the field model
  Field.init({
    id: {type: DataTypes.STRING, primaryKey: true, allowNull: false},
    name: {type: DataTypes.STRING, allowNull: false},
    sortOrder: {type: DataTypes.INTEGER, allowNull: false},
    sortDescending: {type: DataTypes.BOOLEAN, allowNull: false},
  }, {sequelize: db, tableName: 'fields', timestamps: false, indexes: [{name: 'fieldId', unique: true, fields: ['boardId', 'name']}]});

  // Define the score nmodel
  Score.init({
    id: {type: DataTypes.STRING, primaryKey: true, allowNull: false},
    value: {type: DataTypes.INTEGER, allowNull: false},
  }, {sequelize: db, tableName: 'scores', timestamps: false, indexes: [{name: 'scoreId', unique: true, fields: ['boardId', 'contestantId', 'fieldId']}]});

  // Define associations
  Field.Board = Field.belongsTo(Board, {as: 'board', foreignKey: 'boardId'});
  Board.Fields = Board.hasMany(Field, {as: 'fields', foreignKey: 'boardId'});

  Score.Board = Score.belongsTo(Board, {as: 'board', foreignKey: 'boardId'});
  Board.Scores = Board.hasMany(Score, {as: 'scores', foreignKey: 'boardId'});

  Score.Contestant = Score.belongsTo(Contestant, {as: 'contestant', foreignKey: 'contestantId'});
  Contestant.Scores = Contestant.hasMany(Score, {as: 'scores', foreignKey: 'contestantId'});

  Score.Field = Score.belongsTo(Field, {as: 'field', foreignKey: 'fieldId'});
  Field.Scores = Field.hasMany(Score, {as: 'scores', foreignKey: 'fieldId'});
};

// Export the models
module.exports.Application = Application;
module.exports.Contestant = Contestant;
module.exports.Board = Board;
module.exports.Field = Field;
module.exports.Score = Score;

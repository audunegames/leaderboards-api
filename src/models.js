const { Model, DataTypes } = require('sequelize');


// Class that defines an application
class Application extends Model
{
  // Convert the application to its API representation
  async toAPI(include = []) {
    const object = {key: this.key, name: this.name, admin: this.admin, createdAt: this.createdAt, updatedAt: this.updatedAt};
    if (include.includes('secret') && this.secret !== undefined)
      object.secret = this.secret;
    return object;
  }

  // Convert an array of applications to its API representation
  static async arrayToAPI(applications, include = []) {
    return await Promise.all(applications.map(async application => await application.toAPI(include)));
  }
}

// Class that defines a contestant
class Contestant extends Model
{
  // Convert the contestant to its API representation
  async toAPI(include = []) {
    const object = {id: this.id, name: this.name, createdAt: this.createdAt, updatedAt: this.updatedAt};
    if (include.includes('entries'))
      object.entries = await ScoreEntry.arrayToAPI(this.entries, ['board']);
    return object;
  }

  // Convert an array of contestants to its API representation
  static async arrayToAPI(contestants, include = []) {
    return await Promise.all(contestants.map(async contestant => await contestant.toAPI(include)));
  }
}

// Class that defines a board
class Board extends Model
{
  // Convert the board to its API representation
  async toAPI(include = []) {
    const object = {id: this.id, name: this.name, createdAt: this.createdAt, updatedAt: this.updatedAt};
    if (include.includes('fields') && this.fields !== undefined)
      object.fields = await Field.arrayToAPI(this.fields);
    if (include.includes('entries') && this.entries !== undefined)
      object.entries = await ScoreEntry.arrayToAPI(this.entries, ['contestant']);
    return object;
  }

  // Convert an array of boards to its API representation
  static async arrayToAPI(boards, include = []) {
    return await Promise.all(boards.map(async board => await board.toAPI(include)));
  }
}

// Class that defines a field
class Field extends Model
{
  // Compare two values based on the field
  compareValues(a, b) {
    console.log(`Comparing values on field ${this.name}: ${a} and ${b}`);
    if (a === undefined || b === undefined)
      throw new Error('One or both operands are undefined');

    if (this.sortDescending)
      return a - b;
    else
      return b - a;
  }

  // Convert the field to its API representation
  async toAPI() {
    return {sortOrder: this.sortOrder, sortDescending: this.sortDescending};
  }

  // Convert an array of fields to its API representation
  static async arrayToAPI(fields) {
    return Object.fromEntries(await Promise.all(fields.map(async field => [field.name, await field.toAPI()])));
  }
}

// Class that defines a score entry
class ScoreEntry extends Model
{
  // Convert a score entry to its API representation
  async toAPI(include = []) {
    const object = {gameVersion: this.gameVersion, gamePlatform: this.gamePlatform, createdAt: this.createdAt, updatedAt: this.updatedAt};
    if (this.values !== undefined)
      object.values = await ScoreValue.arrayToAPI(this.values);
    if (include.includes('board') && this.boardId !== undefined)
      object.board = await Board.findByPk(this.boardId);
    if (include.includes('contestant') && this.contestantId !== undefined)
      object.contestant = await Contestant.findByPk(this.contestantId);
    return object;
  }

  // Convert an array of score entries to its API representation
  static async arrayToAPI(entries, include = []) {
    return await Promise.all(entries.map(async entry => await entry.toAPI(include)));
  }
}

// Class that defines a score value
class ScoreValue extends Model
{
  // Convert a score value to its API representation
  async toAPI() {
    return this.value;
  }
  
  // Convert an array of score values to its API representation
  static async arrayToAPI(values) {
    return Object.fromEntries(await Promise.all(values.map(async value => [(await Field.findByPk(value.fieldId)).name, await value.toAPI()])));
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

  // Define the score entry model
  ScoreEntry.init({
    id: {type: DataTypes.STRING, primaryKey: true, allowNull: false},
    gameVersion: {type: DataTypes.STRING, allowNull: true},
    gamePlatform: {type: DataTypes.STRING, allowNull: true},
  }, {sequelize: db, tableName: 'scoreEntries', indexes: [{name: 'entryId', unique: true, fields: ['boardId', 'contestantId']}]});

  // Define the score value model
  ScoreValue.init({
    id: {type: DataTypes.STRING, primaryKey: true, allowNull: false},
    value: {type: DataTypes.INTEGER, allowNull: false},
  }, {sequelize: db, tableName: 'scoreValues', timestamps: false, indexes: [{name: 'scoreId', unique: true, fields: ['entryId', 'fieldId']}]});

  // Define associations
  Field.Board = Field.belongsTo(Board, {as: 'board', foreignKey: 'boardId'});
  Board.Fields = Board.hasMany(Field, {as: 'fields', foreignKey: 'boardId'});

  ScoreEntry.Board = ScoreEntry.belongsTo(Board, {as: 'board', foreignKey: 'boardId'});
  Board.Entries = Board.hasMany(ScoreEntry, {as: 'entries', foreignKey: 'boardId'});

  ScoreEntry.Contestant = ScoreEntry.belongsTo(Contestant, {as: 'contestant', foreignKey: 'contestantId'});
  Contestant.Entries = Contestant.hasMany(ScoreEntry, {as: 'entries', foreignKey: 'contestantId'});

  ScoreValue.Entry = ScoreValue.belongsTo(ScoreEntry, {as: 'entry', foreignKey: 'entryId'});
  ScoreEntry.Values = ScoreEntry.hasMany(ScoreValue, {as: 'values', foreignKey: 'entryId'})

  ScoreValue.Field = ScoreValue.belongsTo(Field, {as: 'field', foreignKey: 'fieldId'});
  Field.Values = Field.hasMany(ScoreValue, {as: 'values', foreignKey: 'fieldId'});
};

// Export the models
module.exports.Application = Application;
module.exports.Contestant = Contestant;
module.exports.Board = Board;
module.exports.Field = Field;
module.exports.ScoreEntry = ScoreEntry;
module.exports.ScoreValue = ScoreValue;

'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PromptTemplate extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
    }
  };
  PromptTemplate.init({
    title  : DataTypes.STRING,
    prompt  : DataTypes.STRING,
    description  : DataTypes.STRING,
    tags  : DataTypes.STRING,
    template : DataTypes.JSON
  }, {
    sequelize,
      modelName: 'PromptTemplate',
      tableName: 'llmspark_prompt_templates',
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
      underscored: true

  });
  return PromptTemplate;
};
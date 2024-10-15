'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Deployment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
    }
  };
  Deployment.init({
    project_id  : DataTypes.INTEGER,
    deployment_uid  : DataTypes.STRING,
    prompt  : DataTypes.TEXT,
    prompt_variables  : DataTypes.STRING,
    nodes  : DataTypes.INTEGER,
    provider  : DataTypes.ENUM('1', '2', '3', '4', '5'),
    settings  : DataTypes.JSON,
    prompt  : DataTypes.STRING,
    name : DataTypes.STRING,
    model : DataTypes.STRING,
  }, {
    sequelize,
      modelName: 'Deployment',
      tableName: 'llmspark_deployments',
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at' },
      underscored: true,
      paranoid: true

  });
  return Deployment;
};
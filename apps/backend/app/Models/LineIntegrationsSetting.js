"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class LineIntegrationsSetting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  LineIntegrationsSetting.init(
    {
      project_id    : DataTypes.STRING,
      access_token  : DataTypes.STRING,
      channel_id    : DataTypes.STRING,
      destination   : DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "LineIntegrationsSetting",
      tableName: "line_integrations_settings",
      timestamps: false,
      underscored: true,
    }
  );
  return LineIntegrationsSetting;
};
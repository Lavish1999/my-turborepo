"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class InstagramIntegrationsSetting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  InstagramIntegrationsSetting.init(
    {
      project_id    : DataTypes.STRING,
      access_token  : DataTypes.STRING,
      page_id       : DataTypes.STRING,
      verify_token  : DataTypes.STRING,
      loading_message : DataTypes.JSON,
    },
    {
      sequelize,
      modelName: "InstagramIntegrationsSetting",
      tableName: "instagram_integrations_settings",
      timestamps: false,
      underscored: true,
    }
  );
  return InstagramIntegrationsSetting;
};
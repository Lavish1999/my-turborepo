"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class MessengerIntegrationsSetting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  MessengerIntegrationsSetting.init(
    {
      project_id    : DataTypes.STRING,
      access_token  : DataTypes.STRING,
      page_id       : DataTypes.STRING,
      verify_token  : DataTypes.STRING,
      client_id     : DataTypes.STRING,
      client_secret : DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "MessengerIntegrationsSetting",
      tableName: "messenger_integrations_settings",
      timestamps: false,
      underscored: true,
    }
  );
  return MessengerIntegrationsSetting;
};
"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class CrispIntegrationSetting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  CrispIntegrationSetting.init(
    {
      project_id: DataTypes.INTEGER,
      website_id: DataTypes.STRING,
      bot_enabled :  DataTypes.ENUM('0','1'),
      bot_availablity: DataTypes.JSON,
      response_action: DataTypes.JSON,
      re_enable_action: DataTypes.JSON,
      opt_in:DataTypes.STRING,
      webhook_url: DataTypes.STRING,
      optout_origins: DataTypes.STRING,
      visitor_info_keys: DataTypes.STRING,
      reenable_bot_on_session_resolved: DataTypes.ENUM('0','1'),
      extra_context_keys: DataTypes.STRING,
      add_note_on_request_human: DataTypes.JSON,
    },
    {
      sequelize,
      modelName: "CrispIntegrationSetting",
      tableName: "crisp_integration_settings",
      timestamps: false,
      underscored: true,
    }
  );
  return CrispIntegrationSetting;
};
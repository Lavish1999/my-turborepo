"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class DiscordIntegrationsSetting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  DiscordIntegrationsSetting.init(
    {
      project_id: DataTypes.INTEGER,
      guild_id : DataTypes.STRING,
      public_key:DataTypes.STRING,
      application_id : DataTypes.STRING,
      access_token : DataTypes.STRING,
      type: DataTypes.ENUM('custom', 'auth'),
      message_preference: DataTypes.ENUM('mention_bot', 'direct_message'),
      channel_preferences: DataTypes.STRING
    },
    {
      sequelize,
      modelName: "DiscordIntegrationsSetting",
      timestamps: false,
      underscored: true,
    }
  );
  return DiscordIntegrationsSetting;
};
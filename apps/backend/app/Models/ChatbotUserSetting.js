"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotUserSetting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ChatbotUserSetting.init(
    {
      project_id: DataTypes.INTEGER,
      user_id: DataTypes.INTEGER,
      unseen_message_email_notification: DataTypes.BOOLEAN
    },
    {
      sequelize,
      modelName: "ChatbotUserSetting",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ChatbotUserSetting;
};
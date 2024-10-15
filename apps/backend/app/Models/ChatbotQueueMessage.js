"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotQueueMessage extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ChatbotQueueMessage.init(
    {
      project_id: DataTypes.INTEGER,
      session_id: DataTypes.INTEGER,
      message_id: DataTypes.INTEGER
    },
    {
      sequelize,
      modelName: "ChatbotQueueMessage",
      timestamps: false,
      underscored: true,
    }
  );
  return ChatbotQueueMessage;
};
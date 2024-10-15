"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotWidgetQuestion extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ChatbotWidgetQuestion.init(
    {
        chatbot_integration_id: DataTypes.INTEGER,
        label : DataTypes.STRING,
        question : DataTypes.STRING
    },
    {
      sequelize,
      modelName: "ChatbotWidgetQuestion",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ChatbotWidgetQuestion;
};
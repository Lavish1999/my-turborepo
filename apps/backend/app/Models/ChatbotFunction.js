"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotFunction extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ChatbotFunction.init(
    {
      project_id: DataTypes.INTEGER,
      chatbot_id : DataTypes.INTEGER,
      value : DataTypes.JSON,
      settings : DataTypes.JSON,
      type: DataTypes.STRING,
      enabled : DataTypes.BOOLEAN
    },
    {
      sequelize,
      modelName: "ChatbotFunction",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true
    }
  );
  return ChatbotFunction;
};
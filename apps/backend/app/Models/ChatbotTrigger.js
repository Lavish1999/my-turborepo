"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotTrigger extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ChatbotTrigger.init(
    {
      chatbot_id: DataTypes.INTEGER,
      project_id: DataTypes.INTEGER,
      name: DataTypes.STRING,
      data: DataTypes.JSON,
      status: DataTypes.ENUM("0", "1"),
    },
    {
      sequelize,
      modelName: "ChatbotTrigger",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ChatbotTrigger;
};
"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotWebhook extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ChatbotWebhook.init(
    {
      project_id: DataTypes.INTEGER,
      webhook_url: DataTypes.STRING,
      event: DataTypes.STRING,
      is_enabled: DataTypes.ENUM("0", "1"),
    },
    {
      sequelize,
      modelName: "ChatbotWebhook",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ChatbotWebhook;
};
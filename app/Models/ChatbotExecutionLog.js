"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotExecutionLog extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ChatbotExecutionLog.init(
    {
      project_id: DataTypes.INTEGER,
      session_id: DataTypes.INTEGER,
      data: DataTypes.JSON,
    },
    {
      sequelize,
      modelName: "ChatbotExecutionLog",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ChatbotExecutionLog;
};
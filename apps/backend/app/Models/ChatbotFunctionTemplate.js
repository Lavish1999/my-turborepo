"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotFunctionTemplate extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ChatbotFunctionTemplate.init(
    {
      value : DataTypes.JSON,
      settings : DataTypes.JSON,
      type: DataTypes.STRING
    },
    {
      sequelize,
      modelName: "ChatbotFunctionTemplate",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true
    }
  );
  return ChatbotFunctionTemplate;
};
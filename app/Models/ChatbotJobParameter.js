"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotJobParameter extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ChatbotJobParameter.init(
    {
      job_id : DataTypes.INTEGER,
      key: DataTypes.STRING,
      value: DataTypes.TEXT
    },
    {
      sequelize,
      modelName: "ChatbotJobParameter",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true
    }
  );
  return ChatbotJobParameter;
};
"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotCreditUsage extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ChatbotCreditUsage.init(
    {
      project_id: DataTypes.INTEGER,
      organization_id: DataTypes.INTEGER,
      type : DataTypes.STRING,
      value:DataTypes.STRING
    },
    {
      sequelize,
      modelName: "ChatbotCreditUsage",
      timestamps: { createdAt: "created_at" },
      updatedAt : false,
      underscored: true,
    }
  );
  return ChatbotCreditUsage;
};
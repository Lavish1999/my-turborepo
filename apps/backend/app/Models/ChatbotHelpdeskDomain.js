"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotHelpdeskDomain extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ChatbotHelpdeskDomain.init(
    {
      project_id :DataTypes.INTEGER,
      sub_domain :DataTypes.STRING,
      custom_domain :DataTypes.STRING,
      custom_domain_verified :DataTypes.ENUM("0","1")
    },
    {
      sequelize,
      modelName: "ChatbotHelpdeskDomain",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ChatbotHelpdeskDomain;
};
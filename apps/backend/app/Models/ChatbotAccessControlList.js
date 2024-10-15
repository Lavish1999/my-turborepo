"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotAccessControlList extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ChatbotAccessControlList.init(
    {
      project_id     : DataTypes.INTEGER,
      type      : DataTypes.STRING,
      value       : DataTypes.STRING,
      list_type: DataTypes.ENUM('blocklist', 'whitelist'),
    },
    {
      sequelize,
      modelName: "ChatbotAccessControlList",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ChatbotAccessControlList;
};
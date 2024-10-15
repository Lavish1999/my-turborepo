"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotHelpdesk extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.myAssociation = models.ChatbotHelpdesk.belongsTo(models.ChatbotHelpdeskDomain, { as:'domain', foreignKey: "domain_id"});
    }
  }
  ChatbotHelpdesk.init(
    {
      project_id          :DataTypes.INTEGER,
      name                :DataTypes.STRING,
      custom_html         :DataTypes.TEXT,
      custom_css          :DataTypes.TEXT,
      custom_js           :DataTypes.TEXT,
      logo_url            :DataTypes.STRING,
      language_code       :DataTypes.STRING,
      domain_id           :DataTypes.INTEGER,
      is_chatbot_enabled  :DataTypes.ENUM("0","1"),
      settings            :DataTypes.JSON
    },
    {
      sequelize,
      modelName: "ChatbotHelpdesk",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ChatbotHelpdesk;
};
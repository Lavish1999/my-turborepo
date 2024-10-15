"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotHelpdeskFeedback extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.myAssociation=models.ChatbotHelpdeskFeedback.belongsTo(models.ChatbotHelpdeskArticle, { as: 'article', foreignKey: "article_id"});
    }
  }
  ChatbotHelpdeskFeedback.init(
    {
      project_id :DataTypes.INTEGER,
      article_id :DataTypes.INTEGER,
      visitor_id: DataTypes.INTEGER,
      was_helpful: DataTypes.ENUM("0","1"),
      ip: DataTypes.STRING
    },
    {
      sequelize,
      modelName: "ChatbotHelpdeskFeedback",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ChatbotHelpdeskFeedback;
};
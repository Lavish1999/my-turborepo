"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotHelpdeskCategory extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.myAssociation=models.ChatbotHelpdeskCategory.hasMany(models.ChatbotHelpdeskArticle, { as: 'category_articles', foreignKey: "category_id"});
      this.myAssociation=models.ChatbotHelpdeskCategory.hasMany(models.ChatbotHelpdeskCategory, { as: 'sub_categories', foreignKey: "parent_id"});
      this.myAssociation=models.ChatbotHelpdeskCategory.belongsTo(models.ChatbotHelpdeskCategory, { as: 'parent_category', foreignKey: "parent_id"});
    }
  }
  ChatbotHelpdeskCategory.init(
    {
      project_id :DataTypes.INTEGER,
      parent_id :DataTypes.INTEGER,
      name :DataTypes.STRING,
      slug :DataTypes.STRING,
      description: DataTypes.TEXT,
      logo_url: DataTypes.TEXT,
      language_code :DataTypes.STRING,
      order_index: DataTypes.FLOAT
    },
    {
      sequelize,
      modelName: "ChatbotHelpdeskCategory",
      tableName: "chatbot_helpdesk_categories",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ChatbotHelpdeskCategory;
};
"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotHelpdeskArticle extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.myAssociation=models.ChatbotHelpdeskArticle.belongsTo(models.User, { as: 'creator', foreignKey: "created_by"});
      this.myAssociation=models.ChatbotHelpdeskArticle.belongsTo(models.ChatbotHelpdeskCategory, { as: 'category', foreignKey: "category_id"});
    }
  }
  ChatbotHelpdeskArticle.init(
    {
      project_id :DataTypes.INTEGER,
      category_id :DataTypes.INTEGER,
      language_code :DataTypes.STRING,
      title :DataTypes.STRING,
      slug :DataTypes.STRING,
      description: DataTypes.TEXT,
      content: DataTypes.JSON,
      md_content: DataTypes.TEXT,
      status: DataTypes.ENUM('pending','running','paused','finished','error','success'),
      status_info: DataTypes.STRING,
      visibility: DataTypes.ENUM('draft', 'published', 'archived'),
      featured: DataTypes.ENUM("0","1"),
      created_by: DataTypes.INTEGER,
      note: DataTypes.TEXT,
      order_index: DataTypes.FLOAT
    },
    {
      sequelize,
      modelName: "ChatbotHelpdeskArticle",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ChatbotHelpdeskArticle;
};
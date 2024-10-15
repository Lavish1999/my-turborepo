"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotHelpdeskArticleVersion extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.myAssociation=models.ChatbotHelpdeskArticleVersion.belongsTo(models.User, { as: 'creator', foreignKey: "created_by"});
    }
  }
  ChatbotHelpdeskArticleVersion.init(
    {
      project_id :DataTypes.INTEGER,
      category_id :DataTypes.INTEGER,
      article_id :DataTypes.INTEGER,
      language_code :DataTypes.STRING,
      title :DataTypes.STRING,
      slug :DataTypes.STRING,
      description: DataTypes.TEXT,
      content: DataTypes.JSON,
      md_content: DataTypes.TEXT,
      status: DataTypes.ENUM('pending','running','paused','finished','error'),
      status_info: DataTypes.STRING,
      visibility: DataTypes.ENUM('draft', 'published', 'archived'),
      featured: DataTypes.ENUM("0","1"),
      created_by: DataTypes.INTEGER,
      note: DataTypes.TEXT,
      order_index: DataTypes.INTEGER
    },
    {
      sequelize,
      modelName: "ChatbotHelpdeskArticleVersion",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ChatbotHelpdeskArticleVersion;
};
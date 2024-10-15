"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class SessionMessagesMeta extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  SessionMessagesMeta.init(
    {
      session_id: DataTypes.INTEGER,
      message_id: DataTypes.INTEGER,
      intent: DataTypes.STRING,
      intent_type: DataTypes.ENUM('studio', 'knowledgebase'),
    },
    {
      sequelize,
      modelName: "SessionMessagesMeta",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return SessionMessagesMeta;
};
"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class SessionMeta extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  SessionMeta.init(
    {
      session_id: DataTypes.INTEGER,
      last_summary_message_id: DataTypes.INTEGER,
      operator: DataTypes.STRING,
      sentiment: DataTypes.STRING,
      summary: DataTypes.TEXT,
      escalated_to_human: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "SessionMeta",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return SessionMeta;
};
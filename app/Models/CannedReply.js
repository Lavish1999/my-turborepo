"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class CannedReply extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  CannedReply.init(
    {
      project_id: DataTypes.INTEGER,
      short_cut : DataTypes.STRING,
      message : DataTypes.STRING,
      created_by: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "CannedReply",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return CannedReply;
};
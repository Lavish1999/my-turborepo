"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class DataDeletionRequest extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  DataDeletionRequest.init(
    {
      user_id: DataTypes.INTEGER,
      status : DataTypes.ENUM('pending', 'deleted'),
      reason: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "DataDeletionRequest",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return DataDeletionRequest;
};
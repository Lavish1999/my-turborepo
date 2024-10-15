"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class FinetuneDataset extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  FinetuneDataset.init(
    {
      description: DataTypes.STRING,
      title : DataTypes.STRING,
      path : DataTypes.STRING,
      category : DataTypes.STRING
    },
    {
      sequelize,
      modelName: "FinetuneDataset",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return FinetuneDataset;
};
"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class UsageData extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  UsageData.init(
    {
      plan_id: DataTypes.INTEGER,
      app_id: DataTypes.INTEGER,
      project_id: DataTypes.INTEGER,
      organization_id: DataTypes.INTEGER,
      usage_type: DataTypes.STRING,
      usage_value : DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "UsageData",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return UsageData;
};
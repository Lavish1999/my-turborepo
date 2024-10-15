"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class CustomWidgetDomain extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  CustomWidgetDomain.init(
    {
      project_id: DataTypes.INTEGER,
      domain_url: DataTypes.STRING,
      is_verified : DataTypes.ENUM('0', '1'),
    },
    {
      sequelize,
      modelName: "CustomWidgetDomain",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return CustomWidgetDomain;
};
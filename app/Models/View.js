"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class View extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  View.init(
    {
      project_id: DataTypes.INTEGER,
      name: DataTypes.STRING,
      created_by: DataTypes.INTEGER,
      visibility: DataTypes.ENUM('me_only', 'everyone'),
      filter_by: DataTypes.JSON,
      icon: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "View",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return View;
};
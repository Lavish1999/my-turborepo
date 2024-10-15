"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class VisitorNavigation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  VisitorNavigation.init(
    {
      project_id: DataTypes.INTEGER,
      visitor_id: DataTypes.INTEGER,
      url : DataTypes.STRING,
      page_title :  DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "VisitorNavigation",
      timestamps: { createdAt: "created_at" },
      underscored: true,
      updatedAt : false
    }
  );
  return VisitorNavigation;
};
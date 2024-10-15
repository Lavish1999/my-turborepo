"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ViewMember extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ViewMember.init(
    {
      view_id: DataTypes.INTEGER,
      user_id: DataTypes.STRING
    },
    {
      sequelize,
      modelName: "ViewMember",
      timestamps: false,
      underscored: true,
    }
  );
  return ViewMember;
};
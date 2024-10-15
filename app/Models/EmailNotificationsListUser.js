"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class EmailNotificationsListUser extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  EmailNotificationsListUser.init(
    {
      user_id: DataTypes.INTEGER,
      type : DataTypes.STRING,
      app_id : DataTypes.INTEGER,
      organization_id: DataTypes.INTEGER
    },
    {
      sequelize,
      modelName: "EmailNotificationsListUser",
      timestamps: { createdAt: "created_at"},
      updatedAt : false,
      underscored: true,
    }
  );
  return EmailNotificationsListUser;
};
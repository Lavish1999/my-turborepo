"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ForgetPassword extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ForgetPassword.init(
    {
      email: DataTypes.STRING,
      hash: DataTypes.STRING,
      user_id: DataTypes.INTEGER,
      expired_at : DataTypes.DATE
    },
    {
      sequelize,
      modelName: "ForgetPassword",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ForgetPassword;
};
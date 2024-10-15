"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class EmailVerification extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  EmailVerification.init(
    {
      email: DataTypes.STRING,
      hash: DataTypes.STRING,
      expired_at : DataTypes.DATE
    },
    {
      sequelize,
      modelName: "EmailVerification",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return EmailVerification;
};
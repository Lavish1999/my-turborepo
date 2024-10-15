"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class UserPromocode extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  UserPromocode.init(
    {
        promocode: DataTypes.STRING,
        email : DataTypes.STRING,
        used : DataTypes.ENUM('0','1'),
        expires_at : DataTypes.DATE
    },
    {
      sequelize,
      modelName: "UserPromocode",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return UserPromocode;
};
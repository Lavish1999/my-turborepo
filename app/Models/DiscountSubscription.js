"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class DiscountSubscription extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  DiscountSubscription.init(
    {
      coupon_id: DataTypes.STRING,
      subscription_id: DataTypes.INTEGER,
      promotion_code : DataTypes.STRING,
      percent_off:DataTypes.STRING,
      invoice_id:DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "DiscountSubscription",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return DiscountSubscription;
};
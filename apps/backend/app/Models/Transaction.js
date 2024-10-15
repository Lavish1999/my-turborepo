"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Transaction extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Transaction.init(
    {
      transaction_id: DataTypes.STRING,
      status: DataTypes.STRING,
      amount: DataTypes.STRING,
      created : DataTypes.INTEGER,
      amount_captured:DataTypes.INTEGER,
      amount_refunded:DataTypes.INTEGER,
      currency:DataTypes.STRING,
      subscription_id:DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Transaction",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return Transaction;
};
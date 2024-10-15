"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class InvoiceLineItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      models.Invoice.belongsTo(models.Subscription,{foreignKey:"subscription_id"})
      models.Invoice.hasOne(models.DiscountSubscription,{foreignKey:"invoice_id"})

      models.Invoice.hasMany(models.InvoiceLineItem,{foreignKey:"invoice_id"})
    }
  }
  InvoiceLineItem.init(
    {
      invoice_id: DataTypes.INTEGER,
      amount : DataTypes.INTEGER,
      amount_excluding_tax:DataTypes.INTEGER,
      currency:DataTypes.STRING,
      description:DataTypes.STRING,
      period_end:DataTypes.INTEGER,
      period_start:DataTypes.INTEGER,
      subscription_id:DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "InvoiceLineItem",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return InvoiceLineItem;
};
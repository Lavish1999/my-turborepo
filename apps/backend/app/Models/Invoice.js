"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Invoice extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      models.Invoice.belongsTo(models.Subscription,{foreignKey:"subscription_id"})
      models.Invoice.hasOne(models.DiscountSubscription,{foreignKey:"invoice_id"})
    }
  }
  Invoice.init(
    {
      invoice_id: DataTypes.STRING,
      amount_due: DataTypes.INTEGER,
      amount_paid: DataTypes.INTEGER,
      amount_remaining : DataTypes.INTEGER,
      created:DataTypes.INTEGER,
      period_start : DataTypes.INTEGER,
      period_end : DataTypes.INTEGER,
      billing_reason : DataTypes.ENUM('subscription_cycle', 'subscription_create', 'subscription_update', 'manual', 'upcoming', 'subscription_threshold'),
      currency:DataTypes.STRING,
      customer_id:DataTypes.STRING,
      transaction_id:DataTypes.STRING,
      customer_email:DataTypes.STRING,
      customer_name:DataTypes.STRING,
      subscription_id:DataTypes.INTEGER,
      status:DataTypes.STRING,
      payment_intent:DataTypes.STRING,
      total:DataTypes.INTEGER,
      subtotal:DataTypes.INTEGER,
      invoice_pdf:DataTypes.STRING,
      hosted_invoice_url : DataTypes.STRING,
      app_id:DataTypes.INTEGER,
      organization_id:DataTypes.INTEGER,
      due_date : DataTypes.INTEGER,
      paid : DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Invoice",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return Invoice;
};
"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Subscription extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.myAssociation=models.Subscription.belongsTo(models.User,{foreignKey : "user_id"});
      this.myAssociation=models.Subscription.hasMany(models.Invoice,{foreignKey : "subscription_id",sourceKey:"id"});
      this.myAssociation=models.Invoice.belongsTo(models.Subscription,{foreignKey : "subscription_id" , as:"subscription_data"});
    }
  }
  Subscription.init(
    {
      subscription_id: DataTypes.STRING,
      app_id : DataTypes.INTEGER,
      organization_id : DataTypes.INTEGER,
      canceled_at: DataTypes.INTEGER,
      cancel_at_period_end:DataTypes.BOOLEAN,
      collection_method: DataTypes.STRING,
      created : DataTypes.INTEGER,
      currency:DataTypes.STRING,
      current_period_end:DataTypes.INTEGER,
      current_period_start:DataTypes.INTEGER,
      customer_id:DataTypes.STRING,
      user_id:DataTypes.STRING,
      project_id : DataTypes.STRING,
      plan_id : DataTypes.INTEGER,
      status:DataTypes.ENUM('active', 'cancel', 'incomplete', 'paused', 'trialing', 'incomplete_expired', 'complete','past_due'),
      stripe_plan_id : DataTypes.STRING,
      plan_name : DataTypes.STRING,
      subscription_benefits : DataTypes.STRING,
      cancel_at: DataTypes.INTEGER,
      gateway_plan_id: DataTypes.STRING
    },
    {
      sequelize,
      modelName: "Subscription",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return Subscription;
};
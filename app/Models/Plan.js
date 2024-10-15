"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Plan extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Plan.init(
    {
        name : DataTypes.STRING,
        app_id: DataTypes.INTEGER,
        stripe_plan_id : DataTypes.STRING,
        inr_stripe_plan_id : DataTypes.STRING,
        test_stripe_plan_id : DataTypes.STRING,
        test_inr_stripe_plan_id : DataTypes.STRING,
        description : DataTypes.STRING,
        type : DataTypes.ENUM('organization', 'project'),
        duration: DataTypes.ENUM('monthly', 'yearly')
    },
    {
      sequelize,
      modelName: "Plan",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return Plan;
};
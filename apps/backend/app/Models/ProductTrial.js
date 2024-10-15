"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ProductTrial extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      models.ProductTrial.belongsTo(models.User,{foreignKey : "user_id",as:"user"})
      models.ProductTrial.hasMany(models.EmailNotificationsListUser,{foreignKey : "user_id",sourceKey : "user_id"})
    }
  }
  ProductTrial.init(
    {
        app_id: DataTypes.INTEGER,
        project_id: DataTypes.INTEGER,
        organization_id : DataTypes.INTEGER,
        user_id : DataTypes.INTEGER,
        plan_id : DataTypes.STRING,
        expiry_date : DataTypes.DATE,
        status : DataTypes.ENUM('free_trial','upgraded')
    },
    {
      sequelize,
      modelName: "ProductTrial",
      timestamps: { createdAt: "created_at"},
      updatedAt : false,
      underscored: true,
    }
  );
  return ProductTrial;
};
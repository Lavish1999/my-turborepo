"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class EmailIntegration extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  EmailIntegration.init(
    {
      project_id: DataTypes.INTEGER,
      workspace_name: DataTypes.STRING,
      domain: DataTypes.STRING,
      domain_verified: DataTypes.ENUM('0', '1'),
    },
    {
      sequelize,
      modelName: "EmailIntegration",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return EmailIntegration;
};
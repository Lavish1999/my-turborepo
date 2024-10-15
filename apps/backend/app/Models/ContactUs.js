"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ContactUs extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ContactUs.init(
    {
      email: DataTypes.STRING,
      name: DataTypes.STRING,
      project_budget: DataTypes.INTEGER,
      message : DataTypes.STRING,
      intrested_in:DataTypes.STRING
    },
    {
      sequelize,
      modelName: "ContactUs",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ContactUs;
};
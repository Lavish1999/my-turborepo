"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class BrevoContact extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  BrevoContact.init(
    {
        brevo_id: DataTypes.INTEGER,
        user_id : DataTypes.INTEGER
    },
    {
      sequelize,
      modelName: "BrevoContact",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return BrevoContact;
};
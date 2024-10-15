"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class IpAddress extends Model {
    static associate(models) {
      // define association here
    }
  }

  IpAddress.init(
    {
      ip: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      city: DataTypes.STRING,
      region: DataTypes.STRING,
      country: DataTypes.STRING,
      loc: DataTypes.STRING,
      org: DataTypes.STRING,
      postal: DataTypes.STRING,
      timezone: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "IpAddress",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return IpAddress;
};
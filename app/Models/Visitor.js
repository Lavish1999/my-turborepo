"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Visitor extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      models.Visitor.hasMany(models.Session,{foreignKey:"visitor_id",as:"session_data"})
      models.Visitor.belongsTo(models.Contact,{foreignKey:"contact_id",as:"contact_data"})
      models.Visitor.hasMany(models.VisitorData,{foreignKey:"visitor_id",as:"visitor_custom_data"})
      models.Visitor.hasMany(models.VisitorNavigation,{foreignKey:"visitor_id",as:"visitor_navigation"})
      models.VisitorNavigation.belongsTo(models.Visitor,{foreignKey:"visitor_id",as:"naviagtion_visitor_data"})
    }
  }
  Visitor.init(
    {
      visitor_uid     : {
        type: DataTypes.BIGINT,
        get() {
          const visitor_uid = this.getDataValue('visitor_uid');
          return typeof visitor_uid == "string" ? Number(visitor_uid) : visitor_uid;
        }
    },
      ip_address      : DataTypes.STRING,
      project_id       : DataTypes.INTEGER,
      country          : DataTypes.STRING,
      name            : DataTypes.STRING,
      contact_id            : DataTypes.STRING,
      region            : DataTypes.STRING,
      language            : DataTypes.STRING,
      browser            : DataTypes.STRING,
      os            : DataTypes.STRING,
      country_name          : DataTypes.STRING,
      status        : DataTypes.ENUM("away", "online", "offline"),
      data     : DataTypes.JSON,
      is_blocked  : DataTypes.ENUM("0","1"),
    },
    {
      sequelize,
      modelName: "Visitor",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return Visitor;
};
"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class UserActivityLog extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  UserActivityLog.init(
    {
        user_id:DataTypes.INTEGER,
        action: DataTypes.STRING,
        info : DataTypes.STRING,
        created_at   : DataTypes.DATE
    },
    {
      sequelize,
      modelName: "UserActivityLog",
      timestamps: false,
      underscored: true,
    }
  );
  return UserActivityLog;
};
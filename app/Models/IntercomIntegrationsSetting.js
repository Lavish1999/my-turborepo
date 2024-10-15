"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class IntercomIntegrationsSetting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  IntercomIntegrationsSetting.init(
    {
      project_id: DataTypes.INTEGER,
      intercom_app_id : DataTypes.STRING,
      assignee_id:DataTypes.INTEGER,
      access_token : DataTypes.STRING,
      type : DataTypes.STRING,
      workspace_id : DataTypes.STRING,
      loading_message : DataTypes.JSON,
    },
    {
      sequelize,
      modelName: "IntercomIntegrationsSetting",
      timestamps: false,
      underscored: true,
    }
  );
  return IntercomIntegrationsSetting;
};
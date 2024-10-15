"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class WhatsappIntegrationsSetting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  WhatsappIntegrationsSetting.init(
    {
      project_id      : DataTypes.STRING,
      verify_token    : DataTypes.STRING,
      access_token    : DataTypes.STRING,
      phone_number_id : DataTypes.STRING,
      loading_message : DataTypes.JSON,
      type: DataTypes.ENUM('waba', 'manual'),
      phone_no: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "WhatsappIntegrationsSetting",
      tableName: "whatsapp_integrations_settings",
      timestamps: false,
      underscored: true,
    }
  );
  return WhatsappIntegrationsSetting;
};
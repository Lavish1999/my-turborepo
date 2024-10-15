"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class TwilioSmsIntegrationsSetting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  TwilioSmsIntegrationsSetting.init(
    {
      project_id             : DataTypes.STRING,
      account_sid            : DataTypes.STRING,
      auth_token             : DataTypes.STRING,
      sms_phone_number       : DataTypes.STRING,
      sms_phone_sid          : DataTypes.STRING
    },
    {
      sequelize,
      modelName: "TwilioSmsIntegrationsSetting",
      tableName: "twilio_sms_integrations_settings",
      timestamps: false,
      underscored: true,
    }
  );
  return TwilioSmsIntegrationsSetting;
};
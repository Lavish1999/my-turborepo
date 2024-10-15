"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class TwilioVoiceIntegrationsSetting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  TwilioVoiceIntegrationsSetting.init(
    {
      project_id             : DataTypes.STRING,
      account_sid            : DataTypes.STRING,
      auth_token             : DataTypes.STRING,
      voice_phone_number     : DataTypes.STRING,
      voice_phone_sid        : DataTypes.STRING,
      voice_language         : DataTypes.STRING,
      voice_welcome_message  : DataTypes.STRING,
      voice_error_message    : DataTypes.STRING,
      voice_speech_timeout   : DataTypes.STRING,
      voice_type             : DataTypes.STRING,
      voice_recording        : DataTypes.BOOLEAN
    },
    {
      sequelize,
      modelName: "TwilioVoiceIntegrationsSetting",
      tableName: "twilio_voice_integrations_settings",
      timestamps: false,
      underscored: true,
    }
  );
  return TwilioVoiceIntegrationsSetting;
};
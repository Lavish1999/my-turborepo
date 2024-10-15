"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ChatbotConfig extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }

  ChatbotConfig.init(
    {
      project_id: DataTypes.INTEGER,
      chatbot_id: DataTypes.INTEGER,
      key: DataTypes.STRING,
      value: {
        type: DataTypes.STRING,
        get() {
          let { encrypt, decrypt } = require(baseDir() + "helper/helper");
          const encryptedValue = this.getDataValue('value');
          logInfo("encryptedValue", typeof this.getDataValue('encrypted'));
          const decryptedValue = this.getDataValue('encrypted') === '1' ? decrypt(encryptedValue) : encryptedValue; // Replace with your decryption logic
          return decryptedValue;
        },
      },
      encrypted: DataTypes.ENUM('0', '1'),
      // is_enable: DataTypes.ENUM('0', '1'),
    },
    {
      sequelize,
      modelName: "ChatbotConfig",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ChatbotConfig;
};
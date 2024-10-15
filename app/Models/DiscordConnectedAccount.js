"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class DiscordConnectedAccount extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  DiscordConnectedAccount.init(
    {
      user_id: DataTypes.INTEGER,
      discord_user_id: DataTypes.STRING,
      discord_email: DataTypes.STRING,
      discord_username : DataTypes.STRING,
      discord_global_name:DataTypes.STRING
    },
    {
      sequelize,
      modelName: "DiscordConnectedAccount",
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at' },
      underscored: true,
    }
  );
  return DiscordConnectedAccount;
};
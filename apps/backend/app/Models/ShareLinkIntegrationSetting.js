"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ShareLinkIntegrationSetting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ShareLinkIntegrationSetting.init(
    {
        project_id: DataTypes.INTEGER,
        hash : DataTypes.STRING
    },
    {
      sequelize,
      modelName: "ShareLinkIntegrationSetting",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ShareLinkIntegrationSetting;
};
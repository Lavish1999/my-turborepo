'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ChatbotPartner extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.myAssociation=models.ChatbotPartner.belongsTo(models.User, { as: 'user', foreignKey: "user_id"});
    }
  };
  ChatbotPartner.init({
    name : DataTypes.STRING,
    organization_id   : DataTypes.INTEGER,
    user_id : DataTypes.INTEGER,
    email_config : DataTypes.JSON,
    logo : DataTypes.STRING,
    dashboard_domain : DataTypes.STRING,
    embeded_css : DataTypes.TEXT,
    embeded_javascript : DataTypes.TEXT,
    allowed_integrations : DataTypes.STRING,
    allowed_features : DataTypes.STRING,
    status : DataTypes.ENUM("0","1"),
    widget_domain : DataTypes.STRING,
    partner_uid : DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'ChatbotPartner',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    underscored: true
  });
  return ChatbotPartner;
};
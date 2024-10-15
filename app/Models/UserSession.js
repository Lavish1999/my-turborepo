'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class UserSession extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
        this.myAssociation=models.User.hasMany(models.UserSession, { as: 'UserSession' });
        this.myAssociation=models.User.hasOne(models.UserSession, { as: 'device', foreignKey: "user_id"});
        this.myAssociation=models.UserSession.belongsTo(models.User);
    }
  };
  UserSession.init({
    user_id      : DataTypes.INTEGER,
    token        : DataTypes.STRING,
    fcm_token    : DataTypes.STRING,
    source       : DataTypes.STRING,
    version      : DataTypes.STRING,
    device_info  : DataTypes.STRING,
    ip_address   : DataTypes.STRING,
    country      : DataTypes.STRING,
    expires_at   : DataTypes.DATE,
    created_at   : DataTypes.DATE
  }, {
    sequelize,
      modelName: 'UserSession',
      timestamps: false,
      underscored: true
  });
  return UserSession;
};
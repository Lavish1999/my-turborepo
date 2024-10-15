'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  User.init({
    first_name      : DataTypes.STRING,
    last_name      : DataTypes.STRING,
    phone_no      : DataTypes.STRING,
    phone_code      : DataTypes.STRING,
    profile_pic   : DataTypes.STRING,

    name         : DataTypes.STRING,
    email        : DataTypes.STRING,
    password        : DataTypes.STRING,
    username     : DataTypes.STRING,
    firebase_uid : DataTypes.STRING,
    country      : DataTypes.STRING,
    email_verified : DataTypes.ENUM("0","1"),
    type         : DataTypes.ENUM('google', 'custom', 'github', 'twitter'),
    partner_id   : DataTypes.INTEGER,
    is_blocked   : DataTypes.ENUM("0","1"),
  }, {
    sequelize,
    modelName: 'User',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    underscored: true,
    deletedAt : "deleted_at",
    paranoid : true
  });
  return User;
};
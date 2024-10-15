"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class UserCommunityAndReward extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  UserCommunityAndReward.init(
    {
      user_id                : DataTypes.STRING,
      reviewed_on_g2         : DataTypes.ENUM("0","1"),
      suggested_improvement  : DataTypes.ENUM("0","1"),
      follow_tweet_earn      : DataTypes.ENUM("0","1"),
      review_on_producthunt  : DataTypes.ENUM("0","1"),
    },
    {
      sequelize,
      modelName: "UserCommunityAndReward",
      underscored: true,
      timestamps: false
    }
  );
  return UserCommunityAndReward;
};
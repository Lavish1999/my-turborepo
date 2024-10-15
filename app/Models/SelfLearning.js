"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class SelfLearning extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      models.SelfLearning.belongsTo(models.Session , {sourceKey : "session_id",foreignKey : "session_id",as:"sessiondata"})
    }
  }
  SelfLearning.init(
    {
      session_id: DataTypes.INTEGER,
      detail: DataTypes.TEXT,
      detail_type :  DataTypes.ENUM('FAQ', 'Text'),
      type: DataTypes.ENUM('learn_from_previous_converstaion', 'unable_to_answer', 'crisp_training','like','dislike'),
      project_id : DataTypes.INTEGER,
      tags: DataTypes.TEXT
    },
    {
      sequelize,
      modelName: "SelfLearning",
      tableName: "self_learning",
      timestamps: true,
      underscored: true,
      paranoid : true
    }
  );
  return SelfLearning;
};
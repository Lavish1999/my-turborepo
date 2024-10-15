"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class AutomatedResponse extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.myAssociation=models.AutomatedResponse.hasMany(models.AutomatedResponse,   { as: 'child_automated_responses', foreignKey: "parent_id"});
    }
  }
  AutomatedResponse.init(
    {
        project_id: DataTypes.INTEGER,
        flow_id : DataTypes.STRING,
        user_message : DataTypes.STRING,
        response : DataTypes.STRING,
        language : DataTypes.STRING,
        escalate_to_human : DataTypes.ENUM('0','1'),
        is_enabled : DataTypes.ENUM('0','1'),
        scenario_id : DataTypes.STRING,
        node_id : DataTypes.STRING,
        response_delay: DataTypes.INTEGER,
        parent_id: DataTypes.INTEGER
    },
    {
      sequelize,
      modelName: "AutomatedResponse",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return AutomatedResponse;
};
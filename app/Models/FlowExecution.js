"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class FlowExecution extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  FlowExecution.init(
    {
      project_id: DataTypes.INTEGER,
      session_id : DataTypes.INTEGER,
      visitor_id: DataTypes.INTEGER,
      scenario_id: DataTypes.STRING,
      last_step_id: DataTypes.STRING,
      last_step_count: DataTypes.INTEGER,
      execution_data : DataTypes.JSON,
    },
    {
      sequelize,
      modelName: "FlowExecution",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return FlowExecution;
};
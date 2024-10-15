"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ProjectText extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ProjectText.init(
    {
        project_id: DataTypes.INTEGER,
        detail : DataTypes.STRING,
        short_text : DataTypes.STRING,
        status : DataTypes.ENUM('pending', 'running', 'error', 'deleting', 'success','updating'),
        type : DataTypes.ENUM('faq','text'),
        detail :  DataTypes.STRING,
        node_id : DataTypes.STRING,
        last_index : DataTypes.TIME,
        status_info : DataTypes.STRING,
        attempt : DataTypes.INTEGER
    },
    {
      sequelize,
      modelName: "ProjectText",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return ProjectText;
};
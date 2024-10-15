"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ProjectDomain extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      models.ProjectDomain.belongsTo(models.Project, { foreignKey: "project_id", as: "project" });
    }
  }
  ProjectDomain.init(
    {
      project_id: DataTypes.INTEGER,
      domain: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "ProjectDomain",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at" },
      underscored: true,
      paranoid: true,
    }
  );
  return ProjectDomain;
};

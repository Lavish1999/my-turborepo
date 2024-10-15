'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class ProjectKey extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
           models.ProjectKey.belongsTo(models.Project , {foreignKey : "project_id",as:"project"})
        }
    };
    ProjectKey.init({
        project_id: DataTypes.INTEGER,
        public_key: DataTypes.STRING,
        secret_key: DataTypes.STRING,
        api_key: DataTypes.STRING,
        name: DataTypes.STRING,
        active: DataTypes.ENUM('pending', 'running', 'error', 'deleting', 'success'),
    }, {
        sequelize,
        modelName: 'ProjectKey',
        timestamps: { createdAt: 'created_at'},
        updatedAt:false,
        underscored: true,
        paranoid: true,
        deleted_at :"deleted_at"
    });
    return ProjectKey;
};
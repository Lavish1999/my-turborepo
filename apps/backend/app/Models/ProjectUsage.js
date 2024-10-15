'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class ProjectUsage extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
        }
    };
    ProjectUsage.init({
        project_id  : DataTypes.INTEGER,
        plan        :DataTypes.ENUM('basic','starter_monthly','growth_monthly','professional_monthly','elite_monthly'),
        query_count : DataTypes.INTEGER,
        document_count  : DataTypes.INTEGER,
        next_cycle    :DataTypes.TIME
    }, {
        sequelize,
        modelName: 'ProjectUsage',
        tableName: 'project_usage',
        timestamps: { createdAt: 'created_at'},
        underscored: true,
        updatedAt: false,
    });
    return ProjectUsage;
};
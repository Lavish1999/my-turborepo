'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class ProjectIndex extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            this.myAssociation=models.Project.hasMany(models.ProjectIndex,   { as: 'ProjectIndexes', foreignKey: "project_id"});
        }
    };
    ProjectIndex.init({
        project_id: DataTypes.STRING,
        name: DataTypes.STRING,
        connector: DataTypes.STRING,
        rebuild: DataTypes.ENUM('no','yes'),
        rebuild_duration: DataTypes.INTEGER,
        last_updated_index: DataTypes.DATE,
        next_index: DataTypes.STRING,
        status: DataTypes.ENUM('started','building','finished','null')
    }, {
        sequelize,
        modelName: 'ProjectIndex',
        tableName: 'project_indexes',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at'},
        underscored: true,
        paranoid: true
    });
    return ProjectIndex;
};
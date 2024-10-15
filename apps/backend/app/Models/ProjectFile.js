'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class ProjectFile extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            this.myAssociation=models.Project.hasMany(models.ProjectFile,   { as: 'ProjectFiles', foreignKey: "project_id"});
        }
    };
    ProjectFile.init({
        project_id: DataTypes.INTEGER,
        user_id: DataTypes.INTEGER,
        name: DataTypes.STRING,
        path: DataTypes.STRING,
        node_id:DataTypes.STRING,
        status: DataTypes.ENUM('pending', 'running', 'error', 'deleting', 'success'),
        status_info: DataTypes.STRING,
        connector: DataTypes.ENUM("local","notion","google_drive","dropbox"),
        provider : DataTypes.STRING,
        provider_file_id : DataTypes.INTEGER,
        extra_settings: DataTypes.JSON,
    }, {
        sequelize,
        modelName: 'ProjectFile',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at'},
        underscored: true,
        paranoid: true
    });
    return ProjectFile;
};
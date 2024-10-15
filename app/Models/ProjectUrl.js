'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class ProjectUrl extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            this.myAssociation=models.Project.hasMany(models.ProjectUrl,   { as: 'ProjectUrl', foreignKey: "project_id"});
        }
    };
    ProjectUrl.init({
        site_map_id : DataTypes.INTEGER,
        project_id  : DataTypes.INTEGER,
        url         : DataTypes.STRING,
        user_id     : DataTypes.INTEGER,
        node_id     : DataTypes.STRING,
        last_index : DataTypes.TIME,
        deleted_at  : DataTypes.TIME,
        status: DataTypes.ENUM('pending', 'running', 'error', 'deleting', 'success', 'updating'),
        status_info: DataTypes.STRING,
        extra_settings: DataTypes.JSON,
       
    }, {
        sequelize,
        modelName: 'ProjectUrl',
        tableName: 'project_urls',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at'},
        underscored: true,
        //paranoid: true
    });
    return ProjectUrl;
};
'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class ProjectSiteMap extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            this.myAssociation=models.ProjectSiteMap.belongsTo(models.Project, {foreignKey: "project_id"});
        }
    };
    ProjectSiteMap.init({
        project_id  : DataTypes.INTEGER,
        site_map_url: DataTypes.STRING,
        link_count  : DataTypes.INTEGER,
        last_updated: DataTypes.TIME,
        // deleted_at  : DataTypes.TIME,
    }, {
        sequelize,
        modelName: 'ProjectSiteMap',
        tableName: 'project_sitemaps',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at'},
        underscored: true,
        // paranoid: true
    });
    return ProjectSiteMap;
};
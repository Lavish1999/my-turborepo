'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Project extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            this.myAssociation=models.Project.belongsTo(models.Organization, { as: 'organization', foreignKey: "organization_id"});
            this.myAssociation=models.Project.belongsTo(models.User, { as: 'user', foreignKey: "created_by"});

            this.myAssociation=models.Project.hasOne(models.Organization, { as: 'ProjectOrganization', foreignKey: "id"});
            this.myAssociation=models.Project.hasMany(models.ProjectKey, { as: 'ProjectKeys', foreignKey: "project_id"});

            // this.myAssociation=models.Organization.hasMany(models.Project, { as:'OrganizationProjects', foreignKey: "project_id"});
            this.myAssociation=models.Project.hasMany(models.ProjectSetting, { as:'projectSetting', foreignKey: "project_id"});
            this.myAssociation=models.Project.hasMany(models.DiscordIntegrationsSetting, { as:'discordIntegrationsSetting', foreignKey: "project_id"});
            this.myAssociation=models.Project.hasMany(models.SlackIntegrationsSetting, { as:'slackIntegrationsSetting', foreignKey: "project_id"});
          

            // this.myAssociation=models.Project.hasMany(models.ProjectIntegration, { as:'projectIntegrations', foreignKey: "project_id"});
            this.myAssociation=models.Project.hasMany(models.Session, { as:'session', foreignKey: "project_id"});
            this.myAssociation=models.Project.hasOne(models.ProjectUsage, { as:'ProjectUsage', foreignKey: "project_id"});

           
            this.myAssociation=models.Project.belongsToMany(models.Integration, { through: 'ProjectIntegration', as:'projectIntegration', foreignKey: "project_id", otherKey: 'integration_id' });
            this.myAssociation=models.Integration.belongsToMany(models.Project, { through: 'ProjectIntegration', as:'IntegrationProject', foreignKey: "integration_id", otherKey: 'project_id' });
       
            this.myAssociation=models.Project.hasOne(models.ChatbotIntegrationsSetting, { as: 'integration_setting', foreignKey: "project_id"});
            this.myAssociation=models.Project.hasMany(models.ConnectedProject, { as: 'childChatbot', foreignKey: "project_id"});
            this.myAssociation=models.ConnectedProject.belongsTo(models.Project, { as: 'connected_project_data', foreignKey: "connected_project_id"});
        }
    };
    Project.init({
        organization_id: DataTypes.INTEGER,
        name: DataTypes.STRING,
        type: DataTypes.ENUM('basic','advance'),
        app_id : DataTypes.INTEGER,
        project_uid:DataTypes.STRING,
        purpose: DataTypes.STRING,
        retention_duration: DataTypes.BIGINT,
        created_by: DataTypes.INTEGER,
        partner_id: DataTypes.INTEGER,
        // deleted_at      : DataTypes.TIME,
    }, {
        sequelize,
        modelName: 'Project',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at',deleted_at:"deleted_at" },
        timestamps:true,
        underscored: true,
        paranoid: true,
    });
    return Project;
};
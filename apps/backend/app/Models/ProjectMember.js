'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class ProjectMember extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            this.myAssociation=models.ProjectMember.belongsTo(models.Project, { as: 'Project', foreignKey: "project_id"});
            this.myAssociation=models.Project.hasMany(models.ProjectMember,   { as: 'ProjectMembers', foreignKey: "project_id"});
            this.myAssociation=models.ProjectMember.belongsTo(models.User,   { as: 'user', foreignKey: "user_id"});
            this.myAssociation=models.User.hasMany(models.ProjectMember,   { as: 'ProjectMembers', foreignKey: "user_id"});
            this.myAssociation=models.ProjectMember.hasMany(models.UserSession,   { as: 'projectMemberSession', sourceKey: "user_id", foreignKey: "user_id"});
            this.myAssociation=models.ProjectMember.hasMany(models.ChatbotUserSetting,   { as: 'member_chatbot_user_setting', sourceKey: "user_id", foreignKey: "user_id"});
        }
    };
    ProjectMember.init({
        user_id         : DataTypes.INTEGER,
        project_id      : DataTypes.INTEGER,
        deleted_at      : DataTypes.TIME,
        role            : DataTypes.ENUM('owner','editor','viewer',"operator"),
        organization_id : DataTypes.INTEGER,
    }, {
        sequelize,
        modelName: 'ProjectMember',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        underscored: true,
        paranoid: true,

    });
    return ProjectMember;
};
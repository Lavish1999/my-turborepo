'use strict';
const {
  Model,Integration,Project
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProjectIntegration extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.myAssociation=models.ProjectIntegration.hasOne(models. ChatbotIntegrationsSetting, { as:'chatbotIntegrationsSetting', foreignKey: "project_id"});
      this.myAssociation=models.ProjectIntegration.hasOne(models. DiscordIntegrationsSetting, { as:'discordIntegrationsSetting', foreignKey: "project_id"});
      this.myAssociation=models.ProjectIntegration.hasOne(models. SlackIntegrationsSetting, { as:'slackIntegrationsSetting', foreignKey: "project_id"});
      this.myAssociation=models.ProjectIntegration.hasOne(models. TelegramIntegrationsSetting, { as:'telegramIntegrationsSetting', foreignKey: "project_id"});
      
      this.myAssociation=models.ProjectIntegration.hasOne(models. MessengerIntegrationsSetting, { as:'messengerIntegrationsSetting', foreignKey: "project_id"});
      this.myAssociation=models.ProjectIntegration.hasOne(models. InstagramIntegrationsSetting, { as:'instagramIntegrationsSetting', foreignKey: "project_id"});
      this.myAssociation=models.ProjectIntegration.hasOne(models. LineIntegrationsSetting, { as:'lineIntegrationsSetting', foreignKey: "project_id"});
      this.myAssociation=models.ProjectIntegration.hasOne(models. WhatsappIntegrationsSetting, { as:'whatsappIntegrationsSetting', foreignKey: "project_id"});


      this.myAssociation=models.ProjectIntegration.hasOne(models.CrispIntegrationSetting, {  foreignKey: "project_id"});
      this.myAssociation=models.ProjectIntegration.hasOne(models. DiscordIntegrationsSetting, { as:'DiscordIntegrationsSetting', foreignKey: "project_id"});
      this.myAssociation=models.ProjectIntegration.hasOne(models. SlackIntegrationsSetting, { as:'SlackIntegrationsSetting', foreignKey: "project_id"});
      this.myAssociation=models.ProjectIntegration.hasOne(models. IntercomIntegrationsSetting, { as:'IntercomIntegrationsSetting', foreignKey: "project_id"});

      this.myAssociation=models.ProjectIntegration.hasOne(models. TwilioSmsIntegrationsSetting, { as:'TwilioSmsIntegrationsSetting', foreignKey: "project_id"});
      this.myAssociation=models.ProjectIntegration.hasOne(models. TwilioVoiceIntegrationsSetting, { as:'TwilioVoiceIntegrationsSetting', foreignKey: "project_id"});
    }
  };
  ProjectIntegration.init({
    project_id        : {
      type: DataTypes.INTEGER,
      field: 'project_id',
      references: {
        model: Project,
        key: 'id'
      }
    },
    integration_id    : {
      type: DataTypes.INTEGER,
      field: 'integration_id',
      references: {
        model: Integration,
        key: 'id'
      }
    }
  }, {
    sequelize,
      modelName: 'ProjectIntegration',
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
      underscored: true,

  });
  return ProjectIntegration;
};